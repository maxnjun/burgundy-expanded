export class RoomError extends Error {
  constructor(public status:number,message:string,public code?:string){super(message);this.name="RoomError";}
}
