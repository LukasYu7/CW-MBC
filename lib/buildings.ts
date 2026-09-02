export type Category='personal'|'management'|'corporate';
export type Building={id:number;name:string;address:string;owner:string;landArea:number;floorArea:number;approvalDate:string;note:string;category:Category;lat:number|null;lng:number|null;isPublic?:boolean;updatedAt?:string};

export function fromDatabase(row:Record<string,unknown>):Building{return {
  id:Number(row.id),name:String(row.name??''),address:String(row.address??''),owner:String(row.owner??''),
  landArea:Number(row.land_area??0),floorArea:Number(row.floor_area??0),approvalDate:String(row.approval_date??''),
  note:String(row.note??''),category:String(row.category??'corporate') as Category,lat:row.lat==null?null:Number(row.lat),lng:row.lng==null?null:Number(row.lng),
  isPublic:Boolean(row.is_public),updatedAt:String(row.updated_at??''),
}}

export function toDatabase(building:Partial<Building>){return {
  name:building.name,address:building.address,owner:building.owner,land_area:building.landArea,floor_area:building.floorArea,
  approval_date:building.approvalDate||null,note:building.note||'',category:building.category,lat:building.lat,lng:building.lng,is_public:building.isPublic??true,
}}
