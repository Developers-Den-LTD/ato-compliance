// Safe provider settings update utility
// This bypasses the InsertProviderSettings type to avoid foreign key constraint issues

import { db } from '../db';
import { providerSettings } from './schema';
import { eq } from 'drizzle-orm';

interface SafeProviderUpdate {
  isEnabled?: boolean;
  priority?: number;
  isDefault?: boolean;
  configuration?: any;
}

export async function safeUpdateProviderSettings(
  id: string,
  updates: SafeProviderUpdate
): Promise<any> {
  // Build the update object with only the allowed fields
  const safeUpdates: any = {};
  
  if (updates.isEnabled !== undefined) safeUpdates.isEnabled = updates.isEnabled;
  if (updates.priority !== undefined) safeUpdates.priority = updates.priority;
  if (updates.isDefault !== undefined) safeUpdates.isDefault = updates.isDefault;
  if (updates.configuration !== undefined) safeUpdates.configuration = updates.configuration;
  
  // Perform the update
  const result = await db
    .update(providerSettings)
    .set(safeUpdates)
    .where(eq(providerSettings.id, id))
    .returning();
    
  return result[0];
}

export async function safeCreateProviderSettings(
  provider: 'anthropic' | 'openai' | 'ollama',
  settings: SafeProviderUpdate
): Promise<any> {
  // Build the insert object with only the allowed fields
  const safeInsert: any = {
    provider,
    isEnabled: settings.isEnabled ?? true,
    priority: settings.priority ?? 1,
    isDefault: settings.isDefault ?? false,
    configuration: settings.configuration || {}
  };
  
  // Perform the insert
  const result = await db
    .insert(providerSettings)
    .values(safeInsert)
    .returning();
    
  return result[0];
}
