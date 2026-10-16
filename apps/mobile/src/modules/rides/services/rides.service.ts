import type {CreateRideInput,Ride} from '@cycling/contracts';
import {getSupabase} from '../../../shared/supabase/client';
import {rideFromRow,pointsToGeoJSON} from '../../../shared/supabase/mappers';
export const ridesService={
 async list():Promise<Ride[]>{const {data,error}=await getSupabase().from('rides_private').select('*').order('started_at',{ascending:false}).limit(100);if(error)throw error;return (data??[]).map(rideFromRow)},
 async create(input:CreateRideInput):Promise<{id:string}>{
  const {data,error}=await getSupabase().rpc('save_ride',{
   p_route_id:input.routeId,p_distance_km:input.distanceKm,p_duration_sec:input.durationSec,
   p_started_at:input.startedAt,p_ended_at:input.endedAt,
   p_track:input.coordinates.length>=2?pointsToGeoJSON(input.coordinates):null
  });if(error)throw error;return {id:String(data)};
 }
};
