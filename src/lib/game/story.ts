// The Riverbank Oath — a twisted storyline for the Shadow Fight intro.
// Eight acts timed to the musical sections of "Steel on the Riverbank"
// (141.98s ≈ 2:22). Each act is a DISTINCT painted scene that visually
// depicts its narration — a movie, not subtitles over a static backdrop.
// The twist: the player has been a demon wearing a dead hero's memories
// all along — the "demons" they slew were the real sealers.

export type SceneKind =
  | "dawn_oath" // lone figure swearing at a riverbank at dawn
  | "march_hunt" // silhouette marching across hills, demon shapes ahead
  | "seals" // a body with glowing seals, reflection fading
  | "village" // a village crowd cheering, torches
  | "gate_meet" // the gate, an old master waiting — tension builds
  | "gate_fight" // INTENSE sword fight at the gate — clashing blades, sparks
  | "reflection_twist" // a reflection in water that is NOT the hero
  | "demon_reveal" // the hero's silhouette splits to show the demon
  | "screaming" // the "cheering" crowd revealed as screaming, fleeing
  | "final_riverbank"; // shadow stands where the oath was sworn, river red

export interface StoryBeat {
  t: number;
  end: number;
  act: string;
  lines: string[];
  scene: SceneKind;
}

export const STORY_BEATS: StoryBeat[] = [
  {
    t: 0,
    end: 12,
    act: "I — The Oath",
    scene: "dawn_oath",
    lines: [
      "They say a swordsman once stood on this riverbank.",
      "At dawn, he swore an oath — to find the Gates of Shadow,",
      "and seal them shut forever.",
    ],
  },
  {
    t: 12,
    end: 25,
    act: "II — The Hunt",
    scene: "march_hunt",
    lines: [
      "He was a hero. The last of his order.",
      "One by one, he hunted the demons who had slipped through the gate —",
      "Lynx. Butcher. Widow. Shogun.",
    ],
  },
  {
    t: 25,
    end: 34,
    act: "III — The Seals",
    scene: "seals",
    lines: [
      "Each demon carried a seal. Each seal he claimed.",
      "And with every seal, his reflection began to fade from the river.",
    ],
  },
  {
    t: 34,
    end: 51,
    act: "IV — The Cheers",
    scene: "village",
    lines: [
      "But the villages he saved still cheered his name.",
      "They lit torches. They called him savior.",
      "He told himself it was a fair trade.",
    ],
  },
  {
    t: 51,
    end: 62,
    act: "V — The Master",
    scene: "gate_meet",
    lines: [
      "At last he came to the final gate, where his old master waited.",
      "'You have done well,' the old man said, smiling.",
      "'Now — give me the seals. Let me finish what you started.'",
    ],
  },
  {
    t: 62,
    end: 83,
    act: "VI — The Clash",
    scene: "gate_fight",
    lines: [
      "The shadow refused. The master drew his blade.",
      "Steel rang on steel at the gate of shadow —",
      "the last sealer against the thing that wore his student's face.",
    ],
  },
  {
    t: 83,
    end: 103,
    act: "VII — The Reflection",
    scene: "reflection_twist",
    lines: [
      "The master fell. The shadow took the final seal.",
      "And in the river below, the face that looked back...",
      "was not the swordsman's. It was the master's.",
    ],
  },
  {
    t: 103,
    end: 121,
    act: "VIII — The Truth",
    scene: "demon_reveal",
    lines: [
      "The swordsman had died at the very first gate.",
      "The thing that walked the whole road in his skin was a demon —",
      "wearing his memories, hunting its own kind,",
      "to become the new Gatekeeper.",
    ],
  },
  {
    t: 121,
    end: 134,
    act: "IX — The Screams",
    scene: "screaming",
    lines: [
      "The 'demons' he slew were the real sealers —",
      "the heroes, trying to cage him once more.",
      "The cheers of the people... had been screams all along.",
    ],
  },
  {
    t: 134,
    end: 142,
    act: "Coda — The Riverbank",
    scene: "final_riverbank",
    lines: [
      "Now the shadow stands where the oath was sworn,",
      "wearing a hero's face.",
      "The gates are open. The river runs red.",
      "And you — are the shadow.",
    ],
  },
];

export const STORY_DURATION = 142; // seconds (~2:22)
export const TITLE = "THE RIVERBANK OATH";
