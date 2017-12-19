import {RegisterBehavior} from "../metaDecorators";
import {Behavior} from "./behavior";

@RegisterBehavior()
export class Transform extends Behavior {
  
  x: number;
  y: number;
  rotation: number;
  
  constructor () {
    super();
  }
  
  public Update() {
    console.log(this.getId());
  }
  
  
}