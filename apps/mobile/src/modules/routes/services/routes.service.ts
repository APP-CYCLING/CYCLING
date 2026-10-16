import type {CyclingRoute} from '@cycling/contracts';
import {getSupabase} from '../../../shared/supabase/client';
import {routeFromRow} from '../../../shared/supabase/mappers';
export const routesService={
 async list(difficulty?:string):Promise<CyclingRoute[]>{let q=getSupabase().from('routes_public').select('*').eq('is_demo',false).order('created_at',{ascending:false}).limit(100);if(difficulty)q=q.eq('difficulty',difficulty);const {data,error}=await q;if(error)throw error;return (data??[]).map(routeFromRow)},
 async get(id:string):Promise<CyclingRoute>{const {data,error}=await getSupabase().from('routes_public').select('*').eq('is_demo',false).eq('id',id).single();if(error)throw error;return routeFromRow(data)}
};
