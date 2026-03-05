(function attachEnemyCardModule(globalScope) {
  const enemyCardDefaults = {
    defaultLayerNote: "Enemy cards default to the DM layer in most contexts, but not always."
  };

  function initMoveDots(container = document.getElementById('dm-move-dots')) {
    if (!container) return false;

    container.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const dot = document.createElement('div');
      dot.className = 'dm-dot';
      dot.onclick = (event) => {
        event.stopPropagation();
        dot.classList.toggle('active');
      };
      container.appendChild(dot);
    }

    return true;
  }

  function bindTacticalCardInteractions(options = {}) {
    const tacticalCard = options.tacticalCard || document.getElementById('dm-tactical-card');
    const actionsStack = options.actionsStack || (tacticalCard ? tacticalCard.querySelector('#dm-tac-actions-stack') : null);
    const monsterCard = options.monsterCard || document.getElementById('dm-main-sheet');
    const header = options.header || (tacticalCard ? tacticalCard.querySelector('.dm-tactical-header') : null);

    if (!tacticalCard || !actionsStack || !header) return false;
    if (tacticalCard.dataset.enemyCardBound === '1') return true;

    const isInteractiveTarget = (target) => {
      if (!(target instanceof Element)) return false;
      return target.closest('.dm-tac-stat-btn') ||
             target.closest('.dm-tactical-header') ||
             target.closest('.dm-dot') ||
             target.closest('.dm-tac-move-section');
    };

    const isCardBody = (target) => {
      if (!(target instanceof Element)) return false;
      const card = target.closest('.dm-tactical-card');
      const hdr = target.closest('.dm-tactical-header');
      if (!card || hdr) return false;
      return true;
    };

    tacticalCard.addEventListener('click', (event) => {
      if (isInteractiveTarget(event.target)) {
        return;
      }
      if (isCardBody(event.target)) {
        actionsStack.classList.toggle('visible');
        if (monsterCard) {
          monsterCard.classList.toggle('visible');
        }
      }
    });

    tacticalCard.dataset.enemyCardBound = '1';
    return true;
  }

  function bindEnemyCardRuntime(options = {}) {
    const didInitDots = initMoveDots(options.moveDotsContainer);
    const didBindTactical = bindTacticalCardInteractions(options);
    return {
      didInitDots,
      didBindTactical
    };
  }

  globalScope.EnemyCard = {
    defaults: enemyCardDefaults,
    initMoveDots,
    bindTacticalCardInteractions,
    bindEnemyCardRuntime
  };
})(window);
