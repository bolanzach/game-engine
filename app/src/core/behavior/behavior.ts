import {Engine} from "../engine";
import {UtilsService} from "../util/utilsService";
import {BehaviorAssembler} from '../injection/behaviorAssembler';
import {RegisterBehavior} from '../injection/metaDecorators';
import {ServiceProvider} from "../injection/provider/serviceProvider";

@RegisterBehavior()
export abstract class Behavior {
  
  private id: string;
  private active: boolean = false;
  
  private utilsService: UtilsService = ServiceProvider.get(UtilsService);
  
  constructor () {
    let result = /^function\s+([\w\$]+)\s*\(/.exec(this.constructor.toString());
    let behaviorType = result && result[1] || 'B';
    this.id = this.utilsService.generateId(behaviorType);
    this.active = true;
  }
  
  public abstract update ();
  
  public deactivate () {
    this.active = false;
    Engine.deactivateBehavior(this.getId());
    this.getChildren().forEach((childBehavior) => childBehavior.deactivate());
  }
  
  public destroy () {
  
  }
  
  public addBehavior <T extends Behavior>(behavior: new (...args: any[]) => T): BehaviorAssembler {
    return Engine.attachBehaviorToBehavior(behavior, this.getId());
  }
  
  public getBehavior <T extends Behavior>(behavior: new (...args: any[]) => T): T {
    return Engine.getBehavior(behavior, this.getId());
  }
  
  public getChildren (): Array<Behavior> {
    return Engine.getChildrenBehaviors(this.getId());
  }
  
  public isActive (): boolean {
    return this.active;
  }
  
  public getId (): string {
    return this.id;
  }
  
  public getParent (): Behavior {
    return Engine.getParentBehavior(this.getId());
  }
  
}