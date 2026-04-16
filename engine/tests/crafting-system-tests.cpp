#include <cassert>
#include "core/inventory.h"

int main()
{
  auto iron = ItemFactory::CreateIronStock();
  auto *ironWorkpiece = iron->GetFeature<WorkpieceFeature>();
  assert(ironWorkpiece != nullptr);
  assert(ironWorkpiece->State.Stage == WorkpieceStage::RawStock);

  for (int i = 0; i < 48; ++i)
  {
    const bool heated = Crafting::ApplyHeat(*iron, 36);
    assert(heated);
  }
  assert(ironWorkpiece->State.TemperatureRaw >= 1500);
  assert(Crafting::Cast(*iron, MoldSilhouette::BladeBlank, 4, 10, 3 * 65536));
  assert(ironWorkpiece->State.Stage == WorkpieceStage::CastBlank);

  const int32_t previousSwing = ironWorkpiece->State.SwingEfficiency;
  assert(Crafting::Bend(*iron, BendZone::Center, 1));
  assert(Crafting::Forge(*iron, ForgeZone::Center, 2));
  assert(ironWorkpiece->State.JoinPreparationQuality > 0);
  assert(Crafting::Chip(*iron, 0, 0, 1, 1));
  assert(Crafting::Sharpen(*iron, SharpenSide::Right, 8));
  assert(ironWorkpiece->State.SwingEfficiency != previousSwing || ironWorkpiece->State.CuttingEffectiveness > 0);

  auto wood = ItemFactory::CreateWoodStock();
  auto *woodWorkpiece = wood->GetFeature<WorkpieceFeature>();
  assert(woodWorkpiece != nullptr);
  assert(Crafting::Sharpen(*wood, SharpenSide::Top, 6));
  assert(!Crafting::Forge(*wood, ForgeZone::Center, 1));

  const bool joined = Crafting::Join(*wood, *iron);
  assert(joined);
  assert(woodWorkpiece->State.Stage == WorkpieceStage::AssembledItem);
  assert(woodWorkpiece->State.RuntimeRegions.size() >= 2);
  assert(woodWorkpiece->State.JoinQuality > 0);
  assert(woodWorkpiece->State.JoinedFitScore > 0);
  assert(woodWorkpiece->State.PiercingEffectiveness > 0 || woodWorkpiece->State.BluntEffectiveness > 0);

  auto stone = ItemFactory::CreateStoneStock();
  auto *stoneWorkpiece = stone->GetFeature<WorkpieceFeature>();
  assert(stoneWorkpiece != nullptr);
  assert(Crafting::Chip(*stone, 1, 1, 1, 1));
  assert(!Crafting::Forge(*stone, ForgeZone::Center, 1));
  assert(!Crafting::Bend(*stone, BendZone::Center, 1));
  assert(stoneWorkpiece->State.ProfileMask.size() == static_cast<size_t>(stoneWorkpiece->State.ProfileWidth) * static_cast<size_t>(stoneWorkpiece->State.ProfileHeight));

  auto spear = ItemFactory::CreateWoodStock();
  auto spearHead = ItemFactory::CreateIronStock();
  for (int i = 0; i < 48; ++i)
    assert(Crafting::ApplyHeat(*spearHead, 36));
  assert(Crafting::Cast(*spearHead, MoldSilhouette::SpikeBlank, 3, 12, 2 * 65536));
  assert(Crafting::Sharpen(*spearHead, SharpenSide::Right, 10));
  assert(Crafting::Join(*spear, *spearHead));

  auto hammer = ItemFactory::CreateWoodStock();
  auto hammerHead = ItemFactory::CreateIronStock();
  for (int i = 0; i < 48; ++i)
    assert(Crafting::ApplyHeat(*hammerHead, 36));
  assert(Crafting::Cast(*hammerHead, MoldSilhouette::HammerHeadBlank, 6, 4, 4 * 65536));
  assert(Crafting::Join(*hammer, *hammerHead));

  const auto *spearState = spear->GetFeature<WorkpieceFeature>();
  const auto *hammerState = hammer->GetFeature<WorkpieceFeature>();
  assert(spearState != nullptr);
  assert(hammerState != nullptr);
  assert(spearState->State.PiercingEffectiveness > hammerState->State.PiercingEffectiveness);
  assert(hammerState->State.BluntEffectiveness > spearState->State.BluntEffectiveness);

  return 0;
}
