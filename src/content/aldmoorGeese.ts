import type { Location } from '../rules/state';

/**
 * The lost geese (#192): seven of the royal goose's cousins, wandered off across Aldmoor and tucked
 * away by things a curious rider looks at. Found, each goes home to the goose pond on Westmere green
 * (`rules/places/goose.ts`), and once all seven are home the goose-girl there has her thanks.
 */
const lost = (id: string, at: [number, number], about: string, visit: string): Location => ({
  id,
  kind: 'goose',
  name: 'A Lost Goose',
  at,
  done: false,
  text: { about: [about], visit: [visit] },
});

export const GEESE: Location[] = [
  lost(
    'gooseStones',
    [925, 1104],
    'A goose is standing in the shadow of the Grey Wethers, as still as one of the stones, and hoping you won\u2019t notice her.',
    '*Honk.* She was hoping you hadn\u2019t noticed. She sets off home to the goose pond, in no hurry at all.',
  ),
  lost(
    'gooseFalconer',
    [619, 1077],
    'A goose is eating the falconer\u2019s cabbages, one leaf at a time, and looking very pleased with herself.',
    '*Honk.* She takes one more leaf for the road, and waddles off home to the goose pond.',
  ),
  lost(
    'gooseReeds',
    [1685, 1226],
    'A goose is hiding in the reeds below the mill, pretending to be a duck. She isn\u2019t very good at it.',
    '*Quack,* she says, and then gives up. *Honk.* She climbs out of the reeds and waddles off home to the goose pond.',
  ),
  lost(
    'gooseFold',
    [2215, 613],
    'A goose has got in among the sheep by Old Tam\u2019s fold, and seems to think she\u2019s one of them.',
    '*Honk.* The sheep look relieved. She waddles off down the hill, home to the goose pond.',
  ),
  lost(
    'gooseCrags',
    [1434, 514],
    'A goose is sitting on a ledge below the eagle\u2019s nest, a long way from any water. Nobody knows how she got up there, least of all the goose.',
    '*Honk.* You lift her down, and she bites you for it. Then she waddles off home to the goose pond.',
  ),
  lost(
    'gooseDelving',
    [690, 1748],
    'A goose is standing at the mouth of the old delving, honking down it to hear the echo.',
    '*Honk,* says the goose. *Honk,* says the delving. She seems satisfied with that, and waddles off home to the goose pond.',
  ),
  lost(
    'gooseOak',
    [1985, 1924],
    'A goose is sitting in a hollow oak by the charcoal burners\u2019 camp, and has no intention of coming out.',
    '*Honk.* It takes the charcoal burners and a good deal of coaxing, but out she comes, and off she goes home to the goose pond.',
  ),
];
