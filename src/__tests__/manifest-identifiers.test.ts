/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import runtimeObject from 'src/objects/mahabbat-runtime-state.object';
import defaultRole from 'src/default-role';
import staffRole from 'src/roles/mahabbat-staff.role';
import waiterRole from 'src/roles/mahabbat-pos-waiter.role';
import demoRole from 'src/roles/mahabbat-demo-user.role';
import { RUNTIME_STATE_ID } from 'src/objects/mahabbat-runtime-state.object';

const modules = import.meta.glob('../{objects,indexes,fields,roles,page-layouts,page-layout-tabs,views,navigation-menu-items}/*.ts', { eager: true }) as Record<string, { default?: { config?: unknown; success?: boolean; errors?: unknown[] } }>;

describe('manifest invariants', () => {
  it('does not reuse universal identifiers across entity definitions', () => {
    const owners = new Map<string, string>();
    const duplicates: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'universalIdentifier' && typeof child === 'string') {
          const previous = owners.get(child);
          if (previous) duplicates.push(`${child}: ${previous}, ${path}`);
          owners.set(child, path);
        } else visit(child, `${path}.${key}`);
      }
    };
    for (const [name, module] of Object.entries(modules)) visit(module.default?.config, name);
    expect(owners.size).toBeGreaterThan(100);
    expect(duplicates).toEqual([]);
  });
  it('keeps runtime states private to the function role', () => {
    expect(runtimeObject.success).toBe(true);
    expect(runtimeObject.errors).toEqual([]);
    for (const role of [staffRole, waiterRole, demoRole]) {
      expect(role.config.canReadAllObjectRecords).toBe(false);
      expect(role.config.objectPermissions?.find(p => p.objectUniversalIdentifier === RUNTIME_STATE_ID)).toBeUndefined();
    }
    expect(defaultRole.config.objectPermissions?.find(p => p.objectUniversalIdentifier === RUNTIME_STATE_ID)?.canUpdateObjectRecords).toBe(true);
  });
});
