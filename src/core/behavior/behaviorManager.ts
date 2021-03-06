import {ConductBehavior} from "./conductBehavior";
import {BehaviorAssembler} from "../injection/behaviorAssembler";
import {BehaviorProvider} from "../injection/provider/behaviorProvider";
import {getConstructorName} from "../injection/metaDecorators";
import {Scene} from "../behaviors/scene";
import {BehaviorRecord} from "../injection/provider/behaviorRecord";
import {EventProvider} from "../injection/provider/eventProvider";

export class BehaviorManager {

  private behaviorsToUpdate: any = {};
  private assemblers: any = {};
  
  public initScene (): Scene {
    new Scene(); // have to do something to Scene to have requirejs recognize the module. need a better way to do this
    let record: BehaviorRecord = BehaviorProvider.get('scene');
    let newAssembler = new BehaviorAssembler(record, 'Conduct');
    let sceneBehavior = this.constructBehavior(newAssembler, null);
    return sceneBehavior as Scene;
  }
  
  public attachBehaviorToBehavior <T extends ConductBehavior>(attach: new (...args: any[]) => T, to: string): (props?: any) => void {
    let newBehaviorName = getConstructorName(attach);
    let behaviorRecord = BehaviorProvider.get(newBehaviorName);
    let newAssembler = new BehaviorAssembler(behaviorRecord, to);
    let activeAssembler: BehaviorAssembler = this.assemblers[to];
    
    let createProps = function (props?) {
      props = props || {};
      props.parentId = activeAssembler.parent;
      return props;
    };
    
    if (!activeAssembler) {
      // let a = this.idk[to];
      // this.idk[to] = a ? a[newBehaviorName].z.push(newAssembler) : { z: [newAssembler] };
      // return (configuration?: any) => {
      //   let a = this.idk[to];
      //   if (a) {
      //     a.config = configuration || {};
      //   } else {
      //     // do regular stuff
      //   }
      // };
    }
    
    if (activeAssembler.inactiveChildren[newBehaviorName] || activeAssembler.activeChildren[newBehaviorName]) {
      return; // ? this behavior type is already attached
    }
    
    activeAssembler.inactiveChildren[newBehaviorName] = newAssembler;
    
    return (props?: any) => {
      activeAssembler.childrenAssemblerProps[newBehaviorName] = createProps(props);
      this.activateAssemblerChildren(activeAssembler);
    };
  }
  
  public getBehavior <T extends ConductBehavior>(behavior: new (...args: any[]) => T, from: string): T {
    let parentBehavior: BehaviorAssembler = this.assemblers[from];
    
    if (!parentBehavior) {
      return null;
    }
    
    let assembler = parentBehavior.activeChildren[getConstructorName(behavior)] || {};
    return assembler.behavior;
  }
  
  public find (id: string): ConductBehavior | undefined {
    return this.behaviorsToUpdate[id];
  }
  
  public getChildren (id: string): Array<ConductBehavior> {
    let parentBehavior: BehaviorAssembler = this.assemblers[id];
    
    if (!parentBehavior) {
      return [];
    }
    
    let activeChildren = parentBehavior.activeChildren || {};
    return Object.keys(activeChildren).map(childKey => {
      return activeChildren[childKey].behavior;
    });
  }
  
  public getParent (id: string) {
    let childRecord = this.assemblers[id];
    return this.find((childRecord || {}).parent);
  }
  
  /**
   * Deactivate the ConductBehavior with the given id.
   * This function is not recursive in that it will deactivate all the child Behaviors - that should
   * be contained within the ConductBehavior class.
   * This function will however recursively deactivate the parent ConductBehavior if it requires that this
   * child be activate.
   *
   * @param {string} id
   */
  public deactivate (id: string) {
    //
  }
  
  /**
   * Destroy the ConductBehavior with the given id.
   * This function is not recursive in that it will destroy all the child Behaviors - that should
   * be contained within the ConductBehavior class.
   * This function will however recursively destroy the parent ConductBehavior if it requires that this
   * child exist.
   *
   * @param {string} id
   */
  public destroy (id: string) {
    let assemblerToDestroy: BehaviorAssembler = this.assemblers[id];
  
    if (!assemblerToDestroy) {
      return;
    }
  
    let parentId: string = assemblerToDestroy.parent;
    let parent: BehaviorAssembler = this.assemblers[parentId];
    let behaviorName: string = assemblerToDestroy.name;
  
    if (this.parentRequiresChild(parentId, behaviorName)) {
      this.destroy(parentId);
    }
  
    delete this.assemblers[id];
    delete this.behaviorsToUpdate[id];
    delete parent.activeChildren[behaviorName];
    delete parent.inactiveChildren[behaviorName];
  }
  
  /**
   * Behaviors can require that certain child Behaviors exist. When a ConductBehavior is destroyed or deactivated and
   * its parent requires it, the parent ConductBehavior must be deactivated.
   * This function recursively traverses up the parent ConductBehavior's prototype chain checking if it or any of
   * its super classes require the behavior that was removed.
   *
   * @param {string} parentId
   * @param {string} behaviorName
   * @returns {boolean}
   */
  private parentRequiresChild (parentId: string, behaviorName: string): boolean {
    let parent = this.behaviorsToUpdate[parentId];
    let recursiveLookup = (proto, behaviorName) => {
      let parentProto = Object.getPrototypeOf(proto);
      if (!parentProto) {
        return;
      }
      
      let record = BehaviorProvider.get(getConstructorName(proto.constructor));
      let isRequired = Object.keys((record.requiredChildren || {})).some(behavior => behavior === behaviorName);
      return isRequired || recursiveLookup(parentProto, behaviorName);
    };

    if (!parent) {
      return;
    }
    
    return recursiveLookup(parent, behaviorName);
  }
  
  private activateAssemblerChildren (assembler: BehaviorAssembler) {
    let inactiveChildren = assembler.inactiveChildren || {};
    
    let behaviorCreated: boolean = Object.keys(inactiveChildren).some((behaviorType: string) => {
      let assemblerToActivate = inactiveChildren[behaviorType];
      let canActivate = this.canActivate(assemblerToActivate, assembler);
      
      if (!canActivate) {
        return;
      }
      
      // Create the behavior
      delete inactiveChildren[behaviorType];
      assembler.activeChildren[behaviorType] = {
        assembler: assemblerToActivate,
        behavior: this.constructBehavior(assemblerToActivate, assembler)
      };
      
      // Recursively try to create the new ConductBehavior's children
      this.activateAssemblerChildren(assemblerToActivate);
      return canActivate;
    });
    
    // If a behavior was created and added it may allow others to be created
    if (behaviorCreated) {
      this.activateAssemblerChildren(assembler);
    }
  }
  
  /**
   * Checks if the parentAssembler satisfies all the dependencies for the assemblerToCheck.
   * A dependency is satisfied if the parent has all active Behaviors required by the Assembler.
   * This function ignores the special Props dependency
   *
   * @param {BehaviorAssembler} assemblerToCheck
   * @param {BehaviorAssembler} parentAssembler
   * @return {boolean}
   */
  private canActivate (assemblerToCheck: BehaviorAssembler, parentAssembler: BehaviorAssembler): boolean {
    let dependencies = assemblerToCheck.record.args;
    return dependencies.every(arg => {
      return arg === 'PROPS' || !!parentAssembler.activeChildren[arg];
    });
  }
  
  /**
   * Creates a new ConductBehavior from an Assembler.
   * Registers the Assembler to the assemblers map and allows the new ConductBehavior to be updated
   *
   * Warning: this does not check if the assembler can be activated and if all its dependencies have
   * been satisfied. Run canActivate() before calling this.
   *
   * @param {BehaviorAssembler} assembler
   * @param {BehaviorAssembler} parentAssembler
   * @return {ConductBehavior}
   */
  private constructBehavior (assembler: BehaviorAssembler, parentAssembler: BehaviorAssembler): ConductBehavior {
    let behavior: ConductBehavior;
    let id: string;
    let dependencies = [];
    let config = assembler.record;
    
    if (parentAssembler) {
      let activeBehaviors = parentAssembler.activeChildren;
      dependencies = (config.args || []).map(arg => {
        return activeBehaviors[arg] ?
          activeBehaviors[arg].behavior :
          parentAssembler.childrenAssemblerProps[assembler.name];
      });
    }
    
    behavior = new config.clazz(...dependencies);
    id = behavior.getId();
    
    this.behaviorsToUpdate[id] = behavior;
    this.assemblers[id] = assembler;
    
    EventProvider.getRegisteredEventsMetadata(assembler.name).forEach(providedEvent => {
      EventProvider.registerComponent(providedEvent, behavior);
    });
    
    behavior.onAwake();
    return behavior;
  }
  
}

