# Vendored frontend source

- Tremor Raw LineChart and its local helpers: https://github.com/tremorlabs/tremor
  commit `ca4d588f47820ff3d514d37fa4ee08a4222dec11`, Apache-2.0 (including upstream notices in Tremor-LICENSE.txt).
  Modification: Remix arrow icons use equivalent existing Lucide icons. Integration
  code lives outside the vendor folder. The local `intervalType` prop also accepts
  Recharts' `0` option so Dice!Next can retain every date label without sampling;
  that mode also reserves enough edge padding for complete YYYY-MM-DD labels.
- `src/components/ui/{calendar,form,skeleton,progress,avatar,alert}.tsx` were generated
  by official `shadcn@4.22.1` CLI from official `new-york-v4` registry items. Existing
  customized dialogs, tabs and responsive controls were deliberately preserved.
  shadcn/ui: https://github.com/shadcn-ui/ui, MIT (shadcn-LICENSE.txt). Radix dependencies were installed by
  that CLI, not manually added. See package lock for exact transitive versions.
- React Bits and Skiper assets are not incorporated. Review each asset's license
  before adding it; a visual inspiration is not permission to relicense source.
