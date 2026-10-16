import type {BikeLane} from '@cycling/contracts';
import {getSupabase} from '../../../shared/supabase/client';
import {laneFromRow} from '../../../shared/supabase/mappers';
export const bikeLanesService={async list():Promise<BikeLane[]>{const {data,error}=await getSupabase().from('bike_lanes_public').select('*').limit(500);if(error)throw error;return (data??[]).map(laneFromRow)}};
