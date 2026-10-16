import type {BikeLane,CyclingRoute,Ride,LatLng} from '@cycling/contracts';
type AnyRow=Record<string,any>;
export function asPoints(value:unknown):LatLng[]{
 if(!value || typeof value!=='object')return [];
 const obj=value as {type?:string;coordinates?:unknown};
 if(obj.type!=='LineString'||!Array.isArray(obj.coordinates))return [];
 return obj.coordinates.filter((p):p is [number,number]=>Array.isArray(p)&&p.length>=2&&typeof p[0]==='number'&&typeof p[1]==='number').map(([longitude,latitude])=>({longitude,latitude}));
}
export function routeFromRow(r:AnyRow):CyclingRoute{return {id:r.id,title:r.title,description:r.description,distanceKm:Number(r.distance_km),difficulty:r.difficulty,durationMin:r.duration_min,ascentM:r.ascent_m,coordinates:asPoints(r.path_geojson),isDemo:r.is_demo};}
export function laneFromRow(r:AnyRow):BikeLane{return {id:r.id,name:r.name,kind:r.kind,coordinates:asPoints(r.path_geojson),isDemo:r.is_demo};}
export function rideFromRow(r:AnyRow):Ride{return {id:r.id,routeId:r.route_id,distanceKm:Number(r.distance_km),durationSec:r.duration_sec,startedAt:r.started_at,endedAt:r.ended_at,coordinates:asPoints(r.path_geojson)};}
export function pointsToGeoJSON(points:LatLng[]){return {type:'LineString' as const,coordinates:points.map(p=>[p.longitude,p.latitude])};}
