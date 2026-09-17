import type { VenueId, VenuePlugin } from "./types";

export class VenueRegistry {
  private readonly plugins = new Map<VenueId, VenuePlugin>();

  register(plugin: VenuePlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`venue_duplicate:${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  get(id: VenueId): VenuePlugin {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`venue_unknown:${id}`);
    return plugin;
  }

  list(): VenuePlugin[] {
    return [...this.plugins.values()];
  }

  forChain(chainId: VenuePlugin["chainId"]): VenuePlugin[] {
    return this.list().filter((p) => p.chainId === chainId);
  }
}
