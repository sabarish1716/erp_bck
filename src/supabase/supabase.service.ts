import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — sync disabled');
      return;
    }

    this.client = createClient(url, key);
    console.log('[Supabase] Client initialized');
  }

  getClient(): SupabaseClient | null {
    return this.client || null;
  }

  async syncLocation(data: {
    driverId: string;
    busId?: string;
    latitude: number;
    longitude: number;
    speed?: number;
    mileageKm?: number;
  }) {
    if (!this.client) return;
    try {
      const { error } = await this.client.from('driver_locations').insert({
        driver_id: data.driverId,
        bus_id: data.busId || null,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed || null,
        mileage_km: data.mileageKm || 0,
        created_at: new Date().toISOString(),
      });
      if (error) console.error('[Supabase] Location sync error:', error.message);
    } catch (e) {
      console.error('[Supabase] Location sync exception:', e);
    }
  }

  async syncMileage(data: {
    driverId: string;
    busId?: string;
    totalKm: number;
    date: string;
  }) {
    if (!this.client) return;
    try {
      const { error } = await this.client.from('driver_mileage').upsert(
        {
          driver_id: data.driverId,
          bus_id: data.busId || null,
          total_km: data.totalKm,
          date: data.date,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'driver_id,date' },
      );
      if (error) console.error('[Supabase] Mileage sync error:', error.message);
    } catch (e) {
      console.error('[Supabase] Mileage sync exception:', e);
    }
  }

  async syncDriverStatus(data: {
    driverId: string;
    name: string;
    phone?: string;
    busId?: string;
    status: string;
  }) {
    if (!this.client) return;
    try {
      const { error } = await this.client.from('drivers').upsert(
        {
          driver_id: data.driverId,
          name: data.name,
          phone: data.phone || null,
          bus_id: data.busId || null,
          status: data.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'driver_id' },
      );
      if (error) console.error('[Supabase] Driver sync error:', error.message);
    } catch (e) {
      console.error('[Supabase] Driver sync exception:', e);
    }
  }
}
