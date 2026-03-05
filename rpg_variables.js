(function attachRpgVariableRegistry(globalScope) {
  const registry = {
    global: {
      rulesProfile: {
        ruleset: 'dnd_5e_rough', // system value | applies to: whole app rules text/logic | set by: app config
        actionEconomyModel: 'action_bonus_reaction', // combat stat-like value | applies to: turn economy UI/cards | set by: rules profile
        contestedCheckModel: 'd20_plus_mod_vs_d20_plus_mod', // rules value | applies to: grapple/shove/escape cards | set by: rules profile
        attackRollModel: 'd20_plus_to_hit_vs_ac', // rules value | applies to: attack cards | set by: attack resolution
        spellSaveModel: 'dc_vs_save', // rules value | applies to: save-based cards | set by: spell/effect resolution
        movementUnit: 'ft', // stat formatting value | applies to: movement/range displays | set by: app config
        uiDistanceBuckets: ['5ft', '10ft', '15ft', '20ft', '30ft'] // card/stat option value | applies to: stepped range controls | consumed by: card fields
      },
      combat: {
        encounterId: null, // encounter value | applies to: active battle context | set by: DM/combat manager
        round: null, // combat stat | applies to: timeline/turn trackers | set by: turn manager
        turnIndex: null, // combat stat | applies to: active-turn selection | set by: turn manager
        activeCombatantId: null, // character value ref | applies to: loaded character + card sync | set by: loader/selection
        activeCombatantName: null, // character display value | applies to: UI labels/logs | set by: loader
        trackActionsEnabled: true, // UI behavior value | applies to: TO HIT availability/action locks | toggled by: user/debug controls
        statusEffects: [] // combat state list | applies to: condition-driven modifiers | set by: DM/player effects
      },
      resources: {
        primaryActionAvailable: true, // turn resource stat | applies to: action-cost cards/buttons | consumed by: action lock logic
        bonusActionAvailable: true, // turn resource stat | applies to: bonus-action cards | consumed by: action lock logic
        reactionAvailable: true, // turn resource stat | applies to: reaction cards/triggers | consumed by: reaction logic
        freeObjectInteractionAvailable: true, // turn resource stat | applies to: use-object card | consumed by: card checks
        concentrationActive: false // character combat state | applies to: spell/effect persistence | set by: spell state handling
      },
      derived: {
        proficiencyBonus: 2, // character stat (derived) | applies to: attacks/saves/skills/spells | computed from: level
        passivePerception: null, // character stat (derived) | applies to: search/hide outcomes | computed from: wisdom + prof
        passiveInvestigation: null, // character stat (derived) | applies to: investigation checks | computed from: intelligence + prof
        passiveInsight: null // character stat (derived) | applies to: social/perception cues | computed from: wisdom + prof
      }
    },
    canvas: {
      viewport: {
        zoom: 1, // UI/canvas value | applies to: board rendering scale | set by: zoom controls
        panX: 0, // UI/canvas value | applies to: board horizontal offset | set by: drag/pan
        panY: 0 // UI/canvas value | applies to: board vertical offset | set by: drag/pan
      },
      editLayout: {
        enabled: false, // UI mode value | applies to: drag/edit controls | toggled by: Edit Layout button
        detachedCardIds: [], // card state list | applies to: detached card restoration | set by: detach system
        resetCardsUndoAvailable: false // UI mode state | applies to: RESET CARDS/UNDO button label/state | set by: reset workflow
      },
      debug: {
        cardsHighlightEnabled: false, // UI debug value | applies to: cards visual outlines | toggled by: CARDS debug button
        canvasButtonsHighlightEnabled: false, // UI debug value | applies to: canvas button overlays | toggled by: debug popup
        infoPanelsHighlightEnabled: false // UI debug value | applies to: debug/info windows | toggled by: debug popup
      }
    },
    character: {
      identity: {
        name: '---', // character value | applies to: headers/labels/import logs | set by: character import
        race: '---', // character value | applies to: sheet context + some feature logic | set by: character import
        background: '---', // character value | applies to: RP/support metadata | set by: character import
        alignment: '---', // character value | applies to: display/notes | set by: character import
        classes: [], // character value list | applies to: level/prof and feature access | set by: character import
        totalLevel: null // character stat (derived) | applies to: proficiency scaling | computed from: classes
      },
      abilities: {
        strength: {
          score: null, // character stat | applies to: melee attacks/checks/saves | set by: import/manual edits
          modifier: null, // character stat (derived-ish) | applies to: rolls using STR | computed from: score or imported
          savingThrow: null, // character stat | applies to: STR saves | computed from: mod + proficiency if proficient
          proficientSave: false, // character proficiency value | applies to: STR saving throw math | set by: class/features
          linkedSkills: ['Athletics'] // rules mapping value | applies to: UI hints/check selectors | defined by: ruleset
        },
        dexterity: {
          score: null, // character stat | applies to: initiative/ac/ranged/stealth | set by: import/manual edits
          modifier: null, // character stat | applies to: DEX checks/attacks/saves | computed/imported
          savingThrow: null, // character stat | applies to: DEX saves | computed/imported
          proficientSave: false, // character proficiency value | applies to: DEX save math | set by: class/features
          linkedSkills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] // rules mapping value | applies to: check menus/hints
        },
        constitution: {
          score: null, // character stat | applies to: hp/con saves | set by: import/manual edits
          modifier: null, // character stat | applies to: HP/concentration/saves | computed/imported
          savingThrow: null, // character stat | applies to: CON saves | computed/imported
          proficientSave: false, // character proficiency value | applies to: CON save math | set by: class/features
          linkedSkills: [] // rules mapping value | applies to: skill linkage (none default in 5e)
        },
        intelligence: {
          score: null, // character stat | applies to: knowledge/investigation/spellcasting (some classes) | set by: import/manual edits
          modifier: null, // character stat | applies to: INT checks/saves/spells | computed/imported
          savingThrow: null, // character stat | applies to: INT saves | computed/imported
          proficientSave: false, // character proficiency value | applies to: INT save math | set by: class/features
          linkedSkills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'] // rules mapping value
        },
        wisdom: {
          score: null, // character stat | applies to: perception/insight/survival/spellcasting | set by: import/manual edits
          modifier: null, // character stat | applies to: WIS checks/saves/spells | computed/imported
          savingThrow: null, // character stat | applies to: WIS saves | computed/imported
          proficientSave: false, // character proficiency value | applies to: WIS save math | set by: class/features
          linkedSkills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] // rules mapping value
        },
        charisma: {
          score: null, // character stat | applies to: social checks/spellcasting (some classes) | set by: import/manual edits
          modifier: null, // character stat | applies to: CHA checks/saves/spells | computed/imported
          savingThrow: null, // character stat | applies to: CHA saves | computed/imported
          proficientSave: false, // character proficiency value | applies to: CHA save math | set by: class/features
          linkedSkills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] // rules mapping value
        }
      },
      combat: {
        armorClass: null, // character stat | applies to: attack hit resolution | set by: equipment + effects
        initiativeModifier: 0, // character stat | applies to: initiative rolls/display | derived from DEX/effects
        hitPoints: {
          max: null, // character stat | applies to: survivability/death checks | set by: class level + CON + effects
          current: null, // character stat (volatile) | applies to: damage/healing flows | set by: HP controls/effects
          temporary: 0 // character stat (volatile) | applies to: temporary HP buffer | set by: spells/features
        },
        movement: {
          baseFt: 0, // character stat | applies to: per-turn movement budget | set by: race/class/effects
          maxFt: 0, // character stat (derived volatile) | applies to: current turn movement cap | set by: movement effects
          leftFt: 0 // character stat (volatile) | applies to: movement spending | set by: consume movement actions
        }
      },
      proficiencies: {
        armor: [], // character value list | applies to: legal armor usage/ac assumptions | set by: class/features
        weapons: [], // character value list | applies to: attack proficiency checks | set by: class/features
        tools: [], // character value list | applies to: tool checks | set by: class/background
        skills: [], // character value list | applies to: skill proficiency math | set by: class/background
        savingThrows: [] // character value list | applies to: save proficiency math | set by: class
      },
      spellcasting: {
        isSpellcaster: false, // character capability value | applies to: spell UI and spell card logic | set by: class data
        spellcastingAbility: null, // character rules value | applies to: spell DC/attack bonus math | set by: class
        spellSaveDC: null, // character stat | applies to: SAVE card fields/spell resolves | derived/imported
        spellAttackBonus: null, // character stat | applies to: spell attack cards | derived/imported
        concentration: {
          active: false, // character combat state | applies to: effect persistence | set by: spell state
          source: null // character/card link value | applies to: concentration break cleanup | set by: active spell/effect
        },
        slots: {
          level1: { max: 0, current: 0 }, // character resource stat | applies to: spell cast availability | set by: class level
          level2: { max: 0, current: 0 }, // character resource stat | applies to: spell cast availability | set by: class level
          level3: { max: 0, current: 0 }, // character resource stat | applies to: spell cast availability | set by: class level
          level4: { max: 0, current: 0 }, // character resource stat | applies to: spell cast availability | set by: class level
          level5: { max: 0, current: 0 }, // character resource stat | applies to: spell cast availability | set by: class level
          level6: { max: 0, current: 0 }, // character resource stat | applies to: spell cast availability | set by: class level
          level7: { max: 0, current: 0 }, // character resource stat | applies to: spell cast availability | set by: class level
          level8: { max: 0, current: 0 }, // character resource stat | applies to: spell cast availability | set by: class level
          level9: { max: 0, current: 0 } // character resource stat | applies to: spell cast availability | set by: class level
        }
      }
    },
    conditions: {
      movement: {
        dash: false, // condition/effect value | applies to: movement maxFt increase | toggled by: Dash/action effects
        difficultTerrain: false, // condition/effect value | applies to: movement cost rules | toggled by: terrain/effects
        grappled: false, // condition/effect value | applies to: movement restrictions | toggled by: grapple state
        restrained: false, // condition/effect value | applies to: speed 0 and roll impacts | toggled by: effects
        prone: false, // condition/effect value | applies to: movement/attack modifiers | toggled by: combat state
        haste: false, // condition/effect value | applies to: movement/action boost | toggled by: spell effects
        longstrider: false, // condition/effect value | applies to: movement bonus | toggled by: spell effects
        freedomOfMovement: false // condition/effect value | applies to: ignore movement penalties | toggled by: spell effects
      },
      initiative: {
        advantage: false, // roll modifier state | applies to: initiative roll mode | toggled by: init popout
        disadvantage: false, // roll modifier state | applies to: initiative roll mode | toggled by: init popout
        flatBonus: 0, // stat modifier value | applies to: initiative total | set by: init popout input/toggle
        surprised: false // condition state | applies to: first-turn behavior | toggled by: encounter setup
      },
      hp: {
        bleeding: false, // condition/effect value | applies to: periodic HP loss behavior | toggled by: hp effects
        necroticPressure: false, // condition/effect value | applies to: necrotic-themed HP effects | toggled by: hp effects
        maxHpReduction: 0 // condition/effect stat | applies to: effective max HP | set by: effect handlers
      }
    },
    cards: {
      'card-0': {
        id: 'card-0', // card value | applies to: DOM binding + registry lookup | set by: markup ID
        key: 'unarmed_attack', // card value | applies to: stable internal references | set by: card catalog
        sourceStackId: 'card-stack', // card value | applies to: stack origin + restore behavior | set by: layout markup
        family: 'attack_primary', // card taxonomy value | applies to: grouping/filtering behavior | set by: card catalog
        label: 'Unarmed Attack', // card display value | applies to: card header/active label | set by: card content
        actionCost: 'action', // card resource value | applies to: action consumption/disable state | consumed by: action tracker
        detachable: true, // card interaction value | applies to: edit-layout detach behavior | consumed by: drag handlers
        detached: false, // card runtime state | applies to: stack layout exclusion | set by: detach system
        detachedPosition: null, // card runtime state | applies to: detached placement restore | set by: detach system
        linkedCharacterActionType: 'weapon_or_unarmed', // character-card link value | applies to: import mapping | consumed by: loader
        fields: {
          range: {
            type: 'scroll', // card field value | applies to: stepped control behavior | consumed by: card stat control
            sourceElementId: 'rng-scroll', // card DOM binding | applies to: stat control updates | used by: UI sync
            sourceBoxElementId: 'rng-box', // card DOM binding | applies to: modified/default style state | used by: UI sync
            statKind: 'range', // stat taxonomy value | applies to: roll/effect formatting | used by: action handlers
            defaultValue: '5ft' // card default stat | applies to: reset/no-character baseline | set by: rules baseline
          },
          toHit: {
            type: 'scroll', // card field value | applies to: stepped control behavior | consumed by: card stat control
            sourceElementId: 'hit-scroll', // card DOM binding | applies to: to-hit display/updates | used by: loader
            sourceBoxElementId: 'hit-box', // card DOM binding | applies to: availability/modified visuals | used by: UI sync
            statKind: 'attack_roll_modifier', // stat taxonomy value | applies to: d20 attack roll math | used by: rollers
            defaultValue: '+0' // card default stat | applies to: reset/no-character baseline | set by: baseline reset
          },
          damage: {
            type: 'scroll', // card field value | applies to: stepped control behavior | consumed by: card stat control
            sourceElementId: 'dmg-scroll', // card DOM binding | applies to: damage display/updates | used by: loader
            sourceBoxElementId: 'dmg-box', // card DOM binding | applies to: modified/default visuals | used by: UI sync
            damageTypeSymbolElementId: 'dmg-type-symbol', // card visual binding | applies to: damage type icon sync | used by: card renderer
            statKind: 'damage_roll_or_flat', // stat taxonomy value | applies to: damage roll resolution | used by: rollers
            defaultValue: '1' // card default stat | applies to: reset/no-character baseline | set by: baseline reset
          }
        },
        actions: {
          rollToHit: {
            type: 'd20_plus_modifier', // action resolver value | applies to: to-hit roll logic | consumed by: roll engine
            sourceField: 'toHit' // card-field link value | applies to: roll input selection | set by: card schema
          },
          rollDamage: {
            type: 'dice_formula', // action resolver value | applies to: damage roll logic | consumed by: roll engine
            sourceField: 'damage' // card-field link value | applies to: roll input selection | set by: card schema
          }
        }
      },
      'card-1': {
        id: 'card-1', // card value | applies to: DOM binding + registry lookup | set by: markup ID
        key: 'divine_strike', // card value | applies to: stable internal references | set by: card catalog
        sourceStackId: 'card-stack', // card value | applies to: stack origin + visibility state | set by: layout markup
        family: 'class_feature_bonus', // card taxonomy value | applies to: grouping/filtering behavior | set by: card catalog
        label: 'Divine Strike', // card display value | applies to: card header/active label | set by: card content
        actionCost: 'bonus', // card resource value | applies to: bonus action consumption | consumed by: action tracker
        detachable: false, // card interaction value | applies to: edit-layout detach behavior | consumed by: drag handlers
        fields: {
          uses: { sourceLiteral: '1/1', statKind: 'resource_uses' }, // card stat value | applies to: per-rest/class resource tracking | set by: class feature state
          levelGate: { sourceLiteral: '9th', statKind: 'feature_level_gate' }, // character-card stat | applies to: availability checks | set by: class progression
          radiantBonus: { sourceLiteral: '+4', statKind: 'damage_bonus' } // character-card stat | applies to: damage add-on math | set by: class/ability
        }
      },
      'card-2': {
        id: 'card-2', // card value | applies to: DOM binding + registry lookup | set by: markup ID
        key: 'blight_smite', // card value | applies to: stable internal references | set by: card catalog
        sourceStackId: 'card-stack', // card value | applies to: stack origin + visibility state | set by: layout markup
        family: 'spell_or_feature_attack', // card taxonomy value | applies to: grouping/filtering behavior | set by: card catalog
        label: 'Blight Smite', // card display value | applies to: card header/active label | set by: card content
        actionCost: 'action', // card resource value | applies to: action consumption | consumed by: action tracker
        detachable: false, // card interaction value | applies to: edit-layout detach behavior | consumed by: drag handlers
        fields: {
          range: { sourceLiteral: '30ft', statKind: 'range' }, // card stat value | applies to: targeting legality | set by: card definition
          save: { sourceLiteral: 'DC15', statKind: 'save_dc' }, // character-card stat | applies to: target save resolution | set by: spell/feature math
          necroticDamage: { sourceLiteral: '2d6', statKind: 'damage_dice_necrotic' } // card stat value | applies to: damage resolution | set by: card definition
        }
      },
      'additional-card-0': {
        id: 'additional-card-0', // card value | applies to: DOM binding + registry lookup | set by: markup ID
        key: 'push_shove', // card value | applies to: stable internal references | set by: card catalog
        sourceStackId: 'additional-card-stack', // card value | applies to: additional stack grouping | set by: layout markup
        family: 'universal_action', // card taxonomy value | applies to: grouping/filtering behavior | set by: card catalog
        label: 'Push/Shove', // card display value | applies to: card header/footer/active labels | set by: card content
        actionCost: 'action', // card resource value | applies to: action consumption | consumed by: action tracker
        ruleVariant: 'custom_contested_str_vs_str_dex', // rules linkage value | applies to: contest resolution behavior | consumed by: resolver
        fields: {
          range: { sourceElementId: 'additional-rng-scroll', sourceBoxElementId: 'additional-rng-box', statKind: 'range', defaultValue: '5ft' }, // card stat value | applies to: target legality
          check: { sourceElementId: 'additional-hit-scroll', sourceBoxElementId: 'additional-hit-box', statKind: 'contested_check_mod', defaultValue: '+0' }, // character-card stat | applies to: contested roll math
          statChoice: { sourceElementId: 'additional-stat-scroll', sourceBoxElementId: 'additional-stat-box', statKind: 'ability_selector', defaultValue: 'STR' } // character-card selector | applies to: check ability source
        }
      },
      'additional-card-1': {
        id: 'additional-card-1', // card value | applies to: DOM binding + registry lookup | set by: markup ID
        key: 'grapple', // card value | applies to: stable internal references | set by: card catalog
        sourceStackId: 'additional-card-stack', // card value | applies to: additional stack grouping | set by: layout markup
        family: 'universal_action', // card taxonomy value | applies to: grouping/filtering behavior | set by: card catalog
        label: 'Grapple', // card display value | applies to: card header/footer/active labels | set by: card content
        actionCost: 'action', // card resource value | applies to: action consumption | consumed by: action tracker
        ruleVariant: 'custom_contested_str_vs_str_dex', // rules linkage value | applies to: contest resolution behavior | consumed by: resolver
        fields: {
          range: { sourceElementId: 'grapple-rng-scroll', sourceBoxElementId: 'grapple-rng-box', statKind: 'range', defaultValue: '5ft' }, // card stat value | applies to: target legality
          check: { sourceElementId: 'grapple-check-scroll', sourceBoxElementId: 'grapple-check-box', statKind: 'contested_check_mod', defaultValue: '+0' }, // character-card stat | applies to: grapple roll math
          statChoice: { sourceElementId: 'grapple-stat-scroll', sourceBoxElementId: 'grapple-stat-box', statKind: 'ability_selector', defaultValue: 'STR' } // character-card selector | applies to: check ability source
        }
      },
      'additional-card-2': {
        id: 'additional-card-2', // card value | applies to: DOM binding + registry lookup | set by: markup ID
        key: 'dodge', // card value | applies to: stable internal references | set by: card catalog
        sourceStackId: 'additional-card-stack', // card value | applies to: additional stack grouping | set by: layout markup
        family: 'universal_action', // card taxonomy value | applies to: grouping/filtering behavior | set by: card catalog
        label: 'Dodge', // card display value | applies to: card header/footer/active labels | set by: card content
        actionCost: 'action', // card resource value | applies to: action consumption | consumed by: action tracker
        fields: {
          ready: { sourceElementId: 'dodge-activate-box', statKind: 'action_toggle', defaultValue: 'USE' }, // card state value | applies to: dodge activation/indicator state
          saveType: { sourceElementId: 'dodge-save-scroll', sourceBoxElementId: 'dodge-save-box', statKind: 'save_type_selector' }, // card stat selector | applies to: save-focused effects
          statChoice: { sourceElementId: 'dodge-stat-scroll', sourceBoxElementId: 'dodge-stat-box', statKind: 'ability_selector', defaultValue: 'DEX' } // character-card selector | applies to: default dodge stat linkage
        }
      },
      'additional-card-3': { id: 'additional-card-3', key: 'dash', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Dash', actionCost: 'action' }, // card definition value | applies to: movement boost action handling
      'additional-card-4': { id: 'additional-card-4', key: 'disengage', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Disengage', actionCost: 'action' }, // card definition value | applies to: opportunity-attack avoidance state
      'additional-card-5': { id: 'additional-card-5', key: 'escape', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Escape', actionCost: 'action', ruleVariant: 'custom_contested_str_dex_vs_grapple_dc' }, // card + rule value | applies to: grapple escape resolution
      'additional-card-6': { id: 'additional-card-6', key: 'hide', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Hide', actionCost: 'action' }, // card definition value | applies to: stealth/perception contest prompt
      'additional-card-7': { id: 'additional-card-7', key: 'search', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Search', actionCost: 'action' }, // card definition value | applies to: perception/investigation checks
      'additional-card-8': { id: 'additional-card-8', key: 'improvise', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Improvise', actionCost: 'action' }, // card definition value | applies to: DM adjudicated custom actions
      'additional-card-9': { id: 'additional-card-9', key: 'help', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Help', actionCost: 'action' }, // card definition value | applies to: granting ally advantage
      'additional-card-10': { id: 'additional-card-10', key: 'use_shield', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Use Shield', actionCost: 'action' }, // card definition value | applies to: AC shield on/off transitions
      'additional-card-11': { id: 'additional-card-11', key: 'use_object', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Use Object', actionCost: 'action' }, // card definition value | applies to: object interaction state
      'additional-card-12': { id: 'additional-card-12', key: 'ready', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Ready', actionCost: 'action' }, // card definition value | applies to: delayed trigger/action preparation
      'additional-card-13': { id: 'additional-card-13', key: 'use_class_feature', sourceStackId: 'additional-card-stack', family: 'universal_action', label: 'Use Class Feature', actionCost: 'action' }, // card definition value | applies to: class-feature dispatch placeholder
      'default-template-card': {
        id: 'default-template-card', // template card value | applies to: future card cloning/scaffolding | set by: design system
        key: 'template_generic_action', // template card value | applies to: generated card schema defaults | set by: template authoring
        sourceStackId: null, // template value | applies to: detached/template card state | set by: layout
        family: 'template', // taxonomy value | applies to: editor/template filtering | set by: catalog
        label: 'Default Template', // display value | applies to: template identification | set by: markup
        actionCost: 'action', // default resource value | applies to: cloned card default cost | set by: template
        fields: {
          range: { sourceElementId: 'template-rng-scroll', sourceBoxElementId: 'template-rng-box', statKind: 'range', defaultValue: '5ft' }, // template card field | applies to: generated range controls
          toHit: { sourceElementId: 'template-hit-scroll', sourceBoxElementId: 'template-hit-box', statKind: 'attack_roll_modifier', defaultValue: '+0' }, // template card field | applies to: generated to-hit controls
          damage: { sourceElementId: 'template-dmg-scroll', sourceBoxElementId: 'template-dmg-box', statKind: 'damage_roll_or_flat', defaultValue: '1' } // template card field | applies to: generated damage controls
        }
      }
    },
    mappings: {
      actionBucketOrder: ['weapons', 'spellAttacks', 'abilities', 'primary', 'bonus', 'reaction'], // character-to-card mapping value | applies to: action normalization order | consumed by: character loader
      actionCostToResourceKey: {
        action: 'primaryActionAvailable', // mapping value | applies to: card cost -> turn resource lock | consumed by: action tracker
        bonus: 'bonusActionAvailable', // mapping value | applies to: card cost -> turn resource lock | consumed by: action tracker
        reaction: 'reactionAvailable' // mapping value | applies to: card cost -> turn resource lock | consumed by: reaction tracker
      },
      ruleVariantToResolver: {
        custom_contested_str_vs_str_dex: 'resolveContestedStrVsStrDex', // mapping value | applies to: grapple/shove cards | consumed by: card rule engine
        custom_contested_str_dex_vs_grapple_dc: 'resolveEscapeVsGrappleDc' // mapping value | applies to: escape card | consumed by: card rule engine
      }
    }
  };

  function getCardVariables(cardId) {
    return registry.cards[String(cardId || '')] || null;
  }

  function listCardVariableIds() {
    return Object.keys(registry.cards);
  }

  function getGlobalVariables() {
    return registry.global;
  }

  function getCanvasVariables() {
    return registry.canvas;
  }

  function getCharacterVariables() {
    return registry.character;
  }

  function getConditionVariables() {
    return registry.conditions;
  }

  function getMappings() {
    return registry.mappings;
  }

  globalScope.rpgVariableRegistry = registry;
  globalScope.cardVariableRegistry = registry;
  globalScope.getCardVariables = getCardVariables;
  globalScope.listCardVariableIds = listCardVariableIds;
  globalScope.getGlobalVariables = getGlobalVariables;
  globalScope.getCanvasVariables = getCanvasVariables;
  globalScope.getCharacterVariables = getCharacterVariables;
  globalScope.getConditionVariables = getConditionVariables;
  globalScope.getMappings = getMappings;
})(window);
