(function () {
  const inputValues = [0.2, 0.5, 0.8, 0.3];
  const hiddenLayers = [3, 2];
  const layerSizes = [inputValues.length, ...hiddenLayers, 1];

  const outputAdjustmentStep = 0.1;
  const hiddenNeuronWeightStep = 0.1;
  const neuronPulseDuration = 200;
  const neuronValueEpsilon = 0.0001;
  const networkEl = document.getElementById('network');
  const layersEl = networkEl.querySelector('.layers');
  const svgEl = document.getElementById('connections');
  const weightPanel = document.getElementById('weight-panel');
  const weightPanelTitle = weightPanel.querySelector('.panel-title');
  const weightValueEl = weightPanel.querySelector('.weight-value');
  const weightAdjustButtons = weightPanel.querySelectorAll('[data-delta]');
  const weightCloseBtn = weightPanel.querySelector('.panel-close');
  const neuronPanel = document.getElementById('neuron-panel');
  const neuronPanelTitle = neuronPanel.querySelector('.panel-title');
  const neuronOutputValueEl = neuronPanel.querySelector('.neuron-output-value');
  const neuronExpressionEl = neuronPanel.querySelector('.neuron-expression');
  const neuronCloseBtn = neuronPanel.querySelector('.panel-close');
  const petPreviewEl = document.getElementById('pet-preview');
  const petPreviewImg = petPreviewEl ? petPreviewEl.querySelector('img') : null;
  const petPreviewLink = document.getElementById('pet-preview-link');
  const petPreviewLabelEl = petPreviewEl ? petPreviewEl.querySelector('.pet-preview-label') : null;
  const shuffleButtonEl = document.getElementById('shuffle-inputs');
  const autoCorrectButtonEl = document.getElementById('auto-correct');
  const statusEl = document.getElementById('network-status');
  const fakeCursorEl = document.getElementById('fake-cursor');

  const neuronsByLayer = [];
  let isAutoCorrectAnimating = false;
  const connections = [];
  const expressionHighlightColor = '#fb923c';
  let activeConnection = null;
  let activeNeuron = null;
  let activeControlNeuron = null;
  const connectionOverlayLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svgEl.appendChild(connectionOverlayLayer);
  let activeOverlayLine = null;
  let currentPetType = null;
  let statusTimeoutId = null;
  let statusHideTimeoutId = null;
  let currentPetImageUrl = '';
  const petSpotlightSize = 840;
  const petImages = {
    cat: Array.from({ length: 10 }, (_, index) => `assets/pets/cats/cat-${String(index + 1).padStart(2, '0')}.jpg`),
    dog: Array.from({ length: 10 }, (_, index) => `assets/pets/dogs/dog-${String(index + 1).padStart(2, '0')}.jpg`)
  };
  const petFallbackImages = {
    cat: Array.from({ length: 3 }, (_, index) => `assets/pets/fallback/cat-fallback-${String(index + 1).padStart(2, '0')}.jpg`),
    dog: Array.from({ length: 3 }, (_, index) => `assets/pets/fallback/dog-fallback-${String(index + 1).padStart(2, '0')}.jpg`)
  };

  function pickRandom(list) {
    if (!Array.isArray(list) || list.length === 0) {
      return '';
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  function setStatus(message) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.remove('network-status--visible', 'network-status--flash', 'network-status--dissolve');
    statusEl.style.display = 'inline-flex';
    void statusEl.offsetWidth;
    statusEl.classList.add('network-status--visible', 'network-status--flash');
    if (statusTimeoutId) {
      window.clearTimeout(statusTimeoutId);
    }
    if (statusHideTimeoutId) {
      window.clearTimeout(statusHideTimeoutId);
    }
    statusTimeoutId = window.setTimeout(() => {
      statusEl.classList.remove('network-status--flash');
      statusEl.classList.add('network-status--dissolve');
      statusTimeoutId = null;
      statusHideTimeoutId = window.setTimeout(() => {
        statusEl.classList.remove('network-status--visible', 'network-status--dissolve');
        statusEl.style.display = 'none';
        statusEl.textContent = '';
        statusHideTimeoutId = null;
      }, 1000);
    }, 150);
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return rounded.toFixed(2);
  }

  function makeNeuronLabel(layerIndex, neuronIndex) {
    if (layerIndex === 0) {
      return `Bemenet ${neuronIndex + 1}`;
    }
    if (layerIndex === layerSizes.length - 1) {
      return 'Kimenet';
    }
    return `Rejtett ${layerIndex}-${neuronIndex + 1}`;
  }

  function weightAlpha(weight) {
    const clamp = Math.max(-2, Math.min(2, weight));
    const magnitude = Math.min(1, Math.abs(clamp) / 2);
    const minAlpha = 0.2;
    return minAlpha + magnitude * (1 - minAlpha);
  }

  function weightToColor(weight) {
    const alpha = weightAlpha(weight);
    return `rgba(37, 99, 235, ${alpha.toFixed(2)})`;
  }

  function weightToStroke(weight) {
    const base = 4.0;
    const extra = Math.min(2.5, Math.abs(weight));
    return base + extra * 0.8;
  }

  function refreshConnectionStroke(connection) {
    const hoverBonus = (connection.isPointerHover ? 3 : 0) + (connection.isExpressionHover ? 4 : 0);
    const strokeWidth = connection.baseStroke + hoverBonus;
    const color = connection.isExpressionHover ? expressionHighlightColor : weightToColor(connection.weight);
    connection.line.setAttribute('stroke', color);
    connection.line.setAttribute('stroke-width', strokeWidth);
  }

  function buildLayers() {
    layerSizes.forEach((count, layerIndex) => {
      const layer = [];
      const layerEl = document.createElement('div');
      layerEl.className = 'layer';

      const labelEl = document.createElement('div');
      labelEl.className = 'layer-label';
      if (layerIndex === 0) {
        labelEl.textContent = 'Bemeneti réteg';
      } else if (layerIndex === layerSizes.length - 1) {
        labelEl.textContent = 'Kimeneti réteg';
      } else {
        labelEl.textContent = `Rejtett réteg ${layerIndex}`;
      }
      layerEl.appendChild(labelEl);

      for (let i = 0; i < count; i += 1) {
        const blockEl = document.createElement('div');
        blockEl.className = 'neuron-block';

        const titleEl = document.createElement('div');
        titleEl.className = 'neuron-label';
        titleEl.textContent = makeNeuronLabel(layerIndex, i);

        const neuronEl = document.createElement('div');
        neuronEl.className = 'neuron';
        if (layerIndex === 0) {
          neuronEl.classList.add('neuron--type-input');
        } else if (layerIndex === layerSizes.length - 1) {
          neuronEl.classList.add('neuron--type-output');
        } else {
          neuronEl.classList.add('neuron--type-hidden');
        }

        const valueEl = document.createElement('div');
        valueEl.className = 'neuron-value';
        valueEl.textContent = '0.00';
        neuronEl.appendChild(valueEl);

        blockEl.appendChild(titleEl);
        blockEl.appendChild(neuronEl);

        let predictionEl = null;

        const neuronData = {
          layerIndex,
          index: i,
          element: neuronEl,
          valueEl,
          titleEl,
          blockEl,
          controlsEl: null,
          predictionEl: null,
          incoming: [],
          outgoing: [],
          value: 0,
          midX: 0,
          midY: 0,
          isInitialized: false,
          pulseTimeout: null
        };

        if (layerIndex === layerSizes.length - 1 && i === 0) {
          predictionEl = document.createElement('div');
          predictionEl.className = 'neuron-prediction-label';
          predictionEl.innerHTML = '<span class="neuron-prediction-text">Előrejelzés: —</span><span class="neuron-prediction-icon neuron-prediction-icon--success">✓</span>';
          blockEl.appendChild(predictionEl);
          neuronData.predictionEl = predictionEl;

          const controlsEl = document.createElement('div');
          controlsEl.className = 'neuron-controls neuron-controls--output neuron-controls--persistent';
          const decreaseBtn = document.createElement('button');
          decreaseBtn.type = 'button';
          decreaseBtn.textContent = '-';
          decreaseBtn.setAttribute('aria-label', 'Kimeneti érték csökkentése');
          const increaseBtn = document.createElement('button');
          increaseBtn.type = 'button';
          increaseBtn.textContent = '+';
          increaseBtn.setAttribute('aria-label', 'Kimeneti érték növelése');
          controlsEl.appendChild(decreaseBtn);
          controlsEl.appendChild(increaseBtn);
          blockEl.appendChild(controlsEl);

          decreaseBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            handleOutputAdjustment(-outputAdjustmentStep);
          });
          increaseBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            handleOutputAdjustment(outputAdjustmentStep);
          });
        }

        if (layerIndex > 0 && layerIndex < layerSizes.length - 1) {
          const controlsEl = document.createElement('div');
          controlsEl.className = 'neuron-controls';
          const decreaseBtn = document.createElement('button');
          decreaseBtn.type = 'button';
          decreaseBtn.textContent = '-';
          decreaseBtn.setAttribute('aria-label', 'Bejövő súlyok csökkentése');
          const increaseBtn = document.createElement('button');
          increaseBtn.type = 'button';
          increaseBtn.textContent = '+';
          increaseBtn.setAttribute('aria-label', 'Bejövő súlyok növelése');
          controlsEl.appendChild(decreaseBtn);
          controlsEl.appendChild(increaseBtn);
          blockEl.appendChild(controlsEl);
          neuronData.controlsEl = controlsEl;

          controlsEl.addEventListener('click', (event) => {
            event.stopPropagation();
          });
          decreaseBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            adjustNeuronIncomingWeights(neuronData, -hiddenNeuronWeightStep);
          });
          increaseBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            adjustNeuronIncomingWeights(neuronData, hiddenNeuronWeightStep);
          });
        }

        layerEl.appendChild(blockEl);

        if (layerIndex > 0) {
          neuronEl.classList.add('neuron--clickable');
          neuronEl.addEventListener('click', (event) => {
            event.stopPropagation();
            showNeuronPanel(neuronData);
            if (neuronData.controlsEl) {
              toggleHiddenNeuronControls(neuronData);
            } else {
              hideHiddenNeuronControls();
            }
          });
        }

        layer.push(neuronData);
      }

      neuronsByLayer.push(layer);
      layersEl.appendChild(layerEl);
    });
  }

  function buildConnections() {
    for (let layerIndex = 0; layerIndex < neuronsByLayer.length - 1; layerIndex += 1) {
      const currentLayer = neuronsByLayer[layerIndex];
      const nextLayer = neuronsByLayer[layerIndex + 1];

      currentLayer.forEach((fromNeuron) => {
        nextLayer.forEach((toNeuron) => {
          const weight = Math.round((Math.random() * 2 - 1) * 10) / 10;
          const baseStroke = weightToStroke(weight);

          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('stroke', weightToColor(weight));
          line.setAttribute('stroke-width', baseStroke);
          svgEl.appendChild(line);

        const label = `${fromNeuron.titleEl.textContent} → ${toNeuron.titleEl.textContent}`;
          const connection = {
            from: fromNeuron,
            to: toNeuron,
            weight,
            line,
            label,
            midX: 0,
            midY: 0,
            lastInput: 0,
            lastContribution: 0,
            baseStroke,
            isPointerHover: false,
            isExpressionHover: false,
            id: null,
            handleEl: null
          };

          fromNeuron.outgoing.push(connection);
          toNeuron.incoming.push(connection);
          connections.push(connection);
          connection.id = connections.length - 1;
          line.setAttribute('data-connection-id', String(connection.id));
          refreshConnectionStroke(connection);
          const handleEl = document.createElement('button');
          handleEl.type = 'button';
          handleEl.className = 'connection-handle';
          handleEl.setAttribute('aria-label', `Súly módosítása: ${fromNeuron.titleEl.textContent} → ${toNeuron.titleEl.textContent}`);
          handleEl.addEventListener('click', (event) => {
            event.stopPropagation();
            showWeightPanel(connection);
            setStatus(`Kapcsolat kijelölve: ${label}`);
          });
          handleEl.addEventListener('mouseenter', () => {
            connection.isPointerHover = true;
            refreshConnectionStroke(connection);
          });
          handleEl.addEventListener('mouseleave', () => {
            connection.isPointerHover = false;
            refreshConnectionStroke(connection);
          });
          connection.handleEl = handleEl;
          networkEl.appendChild(handleEl);
          line.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
            showWeightPanel(connection);
            setStatus(`Kapcsolat kijelölve: ${label}`);
          });
          line.addEventListener('pointerenter', () => {
            connection.isPointerHover = true;
            refreshConnectionStroke(connection);
          });
          line.addEventListener('pointerleave', () => {
            connection.isPointerHover = false;
            refreshConnectionStroke(connection);
          });
        });
      });
    }
  }

  function updateConnectionVisual(connection) {
    connection.line.setAttribute('stroke', weightToColor(connection.weight));
    connection.baseStroke = weightToStroke(connection.weight);
    refreshConnectionStroke(connection);
    if (connection === activeConnection) {
      weightValueEl.textContent = formatNumber(connection.weight);
      updateActiveOverlayAppearance();
      setStatus(`Kapcsolat súlya módosítva: ${connection.label}`);
    }
  }

  function setActiveConnection(connection) {
    if (activeConnection && activeConnection.line) {
      activeConnection.line.classList.remove('connection-line--active');
    }
    if (activeOverlayLine && connectionOverlayLayer.contains(activeOverlayLine)) {
      connectionOverlayLayer.removeChild(activeOverlayLine);
      activeOverlayLine = null;
    }
    activeConnection = connection;
    if (activeConnection && activeConnection.line) {
      activeConnection.line.classList.add('connection-line--active');
      activeOverlayLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      activeOverlayLine.classList.add('connection-overlay-line');
      connectionOverlayLayer.appendChild(activeOverlayLine);
      updateActiveOverlayAppearance();
      syncActiveOverlayFromLine();
    }
  }

  function updateActiveOverlayAppearance() {
    if (!activeOverlayLine || !activeConnection) {
      return;
    }
    const alpha = weightAlpha(activeConnection.weight);
    activeOverlayLine.setAttribute('stroke', `rgba(59, 130, 246, ${alpha.toFixed(2)})`);
  }

  function loadRandomPetImage() {
    if (!petPreviewImg || !petPreviewLabelEl) {
      return;
    }
    const isCat = Math.random() >= 0.5;
    const kind = isCat ? 'cat' : 'dog';
    currentPetType = kind;

    let imageUrl = pickRandom(petImages[kind]);
    if (!imageUrl) {
      imageUrl = pickRandom(petFallbackImages[kind]);
    }
    if (!imageUrl) {
      return;
    }

    const label = isCat ? 'Macska' : 'Kutya';
    const alt = isCat ? 'Véletlen macska' : 'Véletlen kutya';

    petPreviewImg.onerror = () => {
      petPreviewImg.onerror = null;
      const fallbackUrl = pickRandom(petFallbackImages[kind]);
      if (fallbackUrl) {
        petPreviewImg.src = fallbackUrl;
        currentPetImageUrl = fallbackUrl;
        if (petPreviewLink) {
          petPreviewLink.href = fallbackUrl;
        }
      }
    };

    petPreviewImg.src = imageUrl;
    currentPetImageUrl = imageUrl;
    if (petPreviewLink) {
      petPreviewLink.href = imageUrl;
      petPreviewLink.setAttribute('data-spotlight-height', String(petSpotlightSize));
      petPreviewLink.setAttribute('data-spotlight-width', String(petSpotlightSize));
    }
    petPreviewImg.alt = alt;
    petPreviewLabelEl.textContent = label;
    petPreviewEl?.setAttribute('data-pet-type', currentPetType);
  }

  function syncActiveOverlayFromLine(x1, y1, x2, y2) {
    if (!activeConnection || !activeOverlayLine) {
      return;
    }
    if (typeof x1 !== 'number' || Number.isNaN(x1)) {
      const line = activeConnection.line;
      if (!line) {
        return;
      }
      x1 = Number(line.getAttribute('x1')) || 0;
      y1 = Number(line.getAttribute('y1')) || 0;
      x2 = Number(line.getAttribute('x2')) || 0;
      y2 = Number(line.getAttribute('y2')) || 0;
    }
    activeOverlayLine.setAttribute('x1', x1);
    activeOverlayLine.setAttribute('y1', y1);
    activeOverlayLine.setAttribute('x2', x2);
    activeOverlayLine.setAttribute('y2', y2);
  }

  function toggleHiddenNeuronControls(neuron) {
    if (!neuron || !neuron.controlsEl) {
      hideHiddenNeuronControls();
      return;
    }
    if (activeControlNeuron === neuron) {
      hideHiddenNeuronControls();
      return;
    }
    hideHiddenNeuronControls();
    neuron.controlsEl.classList.add('neuron-controls--visible');
    activeControlNeuron = neuron;
  }

  function hideHiddenNeuronControls() {
    if (activeControlNeuron && activeControlNeuron.controlsEl) {
      activeControlNeuron.controlsEl.classList.remove('neuron-controls--visible');
    }
    activeControlNeuron = null;
  }

  function adjustNeuronIncomingWeights(neuron, delta) {
    if (!neuron || !Number.isFinite(delta) || !neuron.incoming.length) {
      return;
    }
    neuron.incoming.forEach((connection) => {
      const newWeight = connection.weight + delta;
      connection.weight = Math.round(newWeight * 100) / 100;
      updateConnectionVisual(connection);
    });
    recomputeNetwork();
    setStatus(`Rejtett neuronnál súly módosult: ${neuron.titleEl.textContent}`);
  }

  function updateNeuronValue(neuron, nextValue) {
    if (!neuron || !Number.isFinite(nextValue)) {
      return;
    }
    const previousValue = neuron.value;
    neuron.value = nextValue;
    neuron.valueEl.textContent = formatNumber(nextValue);
    if (!neuron.isInitialized) {
      neuron.isInitialized = true;
      return;
    }
    if (Math.abs(previousValue - nextValue) > neuronValueEpsilon) {
      pulseNeuron(neuron);
    }
  }

  function updateOutputPredictionLabel() {
    const lastLayerIndex = neuronsByLayer.length - 1;
    if (lastLayerIndex < 0) {
      return;
    }
    const outputLayer = neuronsByLayer[lastLayerIndex];
    if (!outputLayer.length) {
      return;
    }
    const outputNeuron = outputLayer[0];
    if (!outputNeuron.predictionEl) {
      return;
    }
    const predictedCat = outputNeuron.value >= 0.5;
    const description = predictedCat ? '1-hez közeli' : '0-hoz közeli';
    const actualCat = currentPetType === 'cat';
    const isCorrect = currentPetType ? predictedCat === actualCat : predictedCat;
    const icon = outputNeuron.predictionEl.querySelector('.neuron-prediction-icon');
    const textEl = outputNeuron.predictionEl.querySelector('.neuron-prediction-text');
    if (textEl) {
      textEl.textContent = 'Előrejelzés: ' + (predictedCat ? 'Macska' : 'Kutya') + ` (${description})`;
    } else {
      outputNeuron.predictionEl.textContent = 'Előrejelzés: ' + (predictedCat ? 'Macska' : 'Kutya') + ` (${description})`;
    }
    if (icon) {
      icon.textContent = isCorrect ? '✓' : '✗';
      icon.classList.toggle('neuron-prediction-icon--success', isCorrect);
      icon.classList.toggle('neuron-prediction-icon--error', !isCorrect);
    }
    outputNeuron.predictionEl.classList.toggle('neuron-prediction-label--cat', predictedCat);
    outputNeuron.predictionEl.classList.toggle('neuron-prediction-label--dog', !predictedCat);

    // Update auto-correct button state
    updateAutoCorrectButtonState(isCorrect);
  }

  function updateAutoCorrectButtonState(isCorrect) {
    if (!autoCorrectButtonEl || isAutoCorrectAnimating) {
      return;
    }
    if (isCorrect) {
      autoCorrectButtonEl.classList.add('layer-action--disabled');
      autoCorrectButtonEl.textContent = 'Már helyes!';
    } else {
      autoCorrectButtonEl.classList.remove('layer-action--disabled');
      autoCorrectButtonEl.textContent = 'Automatikus javítás';
    }
  }

  function pulseNeuron(neuron) {
    if (!neuron || !neuron.element) {
      return;
    }
    const el = neuron.element;
    el.classList.remove('neuron--pulse-orange', 'neuron--pulse-blue', 'neuron--pulse-red');
    if (neuron.pulseTimeout) {
      window.clearTimeout(neuron.pulseTimeout);
    }
    void el.offsetWidth;
    const pulseClass = neuron.layerIndex === 0 ? 'neuron--pulse-orange' : neuron.layerIndex === layerSizes.length - 1 ? 'neuron--pulse-red' : 'neuron--pulse-blue';
    el.classList.add(pulseClass);
    neuron.pulseTimeout = window.setTimeout(() => {
      el.classList.remove('neuron--pulse-orange', 'neuron--pulse-blue', 'neuron--pulse-red');
      neuron.pulseTimeout = null;
    }, neuronPulseDuration);
  }

  function applyWeightChange(connection, delta) {
    if (!connection) {
      return;
    }
    const scaled = Math.round(connection.weight * 10);
    const newScaled = scaled + Math.round(delta * 10);
    connection.weight = newScaled / 10;
    updateConnectionVisual(connection);
    recomputeNetwork();
    setStatus(`Kapcsolat súlya módosítva: ${connection.label}`);
  }

  function recomputeNetwork() {
    neuronsByLayer[0].forEach((neuron, index) => {
      updateNeuronValue(neuron, inputValues[index]);
    });

    for (let layerIndex = 1; layerIndex < neuronsByLayer.length; layerIndex += 1) {
      const layer = neuronsByLayer[layerIndex];
      layer.forEach((neuron) => {
        let sum = 0;
        neuron.incoming.forEach((connection) => {
          const inputVal = connection.from.value;
          const contribution = inputVal * connection.weight;
          connection.lastInput = inputVal;
          connection.lastContribution = contribution;
          sum += contribution;
        });
        updateNeuronValue(neuron, sum);
      });
    }

    updateOutputPredictionLabel();

    if (activeNeuron) {
      updateNeuronPanelContent(activeNeuron);
      placeNeuronPanel(activeNeuron);
    }
  }

  function randomizeInputs() {
    hideHiddenNeuronControls();
    for (let i = 0; i < inputValues.length; i += 1) {
      inputValues[i] = Math.round(Math.random() * 100) / 100;
    }
    loadRandomPetImage();
    recomputeNetwork();
    setStatus('Új bemenetek és állatkép betöltve.');
  }

  function handleOutputAdjustment(delta) {
    if (!Number.isFinite(delta) || !neuronsByLayer.length) {
      return;
    }
    const outputLayer = neuronsByLayer[neuronsByLayer.length - 1];
    if (!outputLayer.length) {
      return;
    }
    const targetValue = outputLayer[0].value + delta;
    const success = adjustNetworkToTargetOutput(targetValue);
    if (!success) {
      window.alert('Nem sikerült a hálót a kívánt kimenetre hangolni.');
      setStatus('Nem sikerült a kívánt kimenetet elérni.');
    } else {
      setStatus('Kimenet finomhangolva a kért értékhez.');
    }
  }

  function handleAutoCorrectRequest() {
    if (isAutoCorrectAnimating) {
      return;
    }
    if (!currentPetType) {
      setStatus('Nincs referencia a helyes címkére.');
      return;
    }
    if (!neuronsByLayer.length) {
      return;
    }
    const outputLayer = neuronsByLayer[neuronsByLayer.length - 1];
    if (!outputLayer.length) {
      setStatus('Hiányzik a kimeneti neuron.');
      return;
    }
    recomputeNetwork();
    const outputNeuron = outputLayer[0];
    const predictedCat = outputNeuron.value >= 0.5;
    const actualCat = currentPetType === 'cat';
    if (predictedCat === actualCat) {
      setStatus('A háló már helyes eredményt ad.');
      return;
    }
    handleAnimatedAutoCorrect();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function moveFakeCursorTo(x, y, duration = 400) {
    return new Promise(resolve => {
      const networkRect = networkEl.getBoundingClientRect();
      fakeCursorEl.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
      fakeCursorEl.style.left = `${x}px`;
      fakeCursorEl.style.top = `${y}px`;
      setTimeout(resolve, duration);
    });
  }

  function showFakeCursor() {
    fakeCursorEl.classList.add('fake-cursor--visible');
  }

  function hideFakeCursor() {
    fakeCursorEl.classList.remove('fake-cursor--visible');
  }

  function clickFakeCursor() {
    fakeCursorEl.classList.remove('fake-cursor--clicking');
    void fakeCursorEl.offsetWidth;
    fakeCursorEl.classList.add('fake-cursor--clicking');
  }

  function highlightNeuron(neuron) {
    neuron.element.classList.remove('neuron--auto-correct-highlight');
    void neuron.element.offsetWidth;
    neuron.element.classList.add('neuron--auto-correct-highlight');
  }

  function willNeuronMakeAdjustments(neuron, targetValue, tolerance, learningRate) {
    // Check if this neuron would actually make any weight adjustments
    const outputLayer = neuronsByLayer[neuronsByLayer.length - 1];
    const currentOutput = outputLayer[0].value;
    const error = currentOutput - targetValue;

    if (Math.abs(error) <= tolerance) {
      return false; // Already at target
    }

    const neuronGradients = computeNeuronGradients();

    for (const connection of neuron.incoming) {
      const gradient = connection.from.value * neuronGradients[neuron.layerIndex][neuron.index];
      if (!Number.isFinite(gradient) || gradient === 0) {
        continue;
      }
      const weightDelta = learningRate * error * gradient;
      // Check if this would result in an actual weight change after rounding
      const currentWeight = connection.weight;
      const newWeight = Math.round((currentWeight - weightDelta) * 100) / 100;
      if (newWeight !== currentWeight) {
        return true; // This neuron will make at least one adjustment
      }
    }
    return false;
  }

  async function handleAnimatedAutoCorrect() {
    if (isAutoCorrectAnimating) {
      return;
    }
    isAutoCorrectAnimating = true;

    // Disable button during animation
    if (autoCorrectButtonEl) {
      autoCorrectButtonEl.classList.add('layer-action--animating');
      autoCorrectButtonEl.classList.remove('layer-action--disabled');
      autoCorrectButtonEl.textContent = 'Javítás...';
    }

    const targetValue = currentPetType === 'cat' ? 1 : 0;
    const tolerance = 0.01;
    const maxIterationsPerNeuron = 50;
    const learningRate = 0.05;

    // Collect all hidden neurons
    const hiddenNeurons = [];
    for (let layerIndex = 1; layerIndex < neuronsByLayer.length - 1; layerIndex++) {
      for (const neuron of neuronsByLayer[layerIndex]) {
        hiddenNeurons.push(neuron);
      }
    }

    if (hiddenNeurons.length === 0) {
      setStatus('Nincsenek rejtett neuronok.');
      isAutoCorrectAnimating = false;
      if (autoCorrectButtonEl) {
        autoCorrectButtonEl.classList.remove('layer-action--animating');
        autoCorrectButtonEl.textContent = 'Automatikus javítás';
      }
      recomputeNetwork(); // This will update button state
      return;
    }

    // Position cursor at starting position (off screen initially)
    const networkRect = networkEl.getBoundingClientRect();
    fakeCursorEl.style.transition = 'none';
    fakeCursorEl.style.left = '-40px';
    fakeCursorEl.style.top = `${networkRect.height / 2}px`;
    void fakeCursorEl.offsetWidth;

    showFakeCursor();
    await sleep(200);

    let overallSuccess = false;
    let visitedAnyNeuron = false;

    // Process each hidden neuron one by one
    for (const neuron of hiddenNeurons) {
      recomputeNetwork();
      const outputLayer = neuronsByLayer[neuronsByLayer.length - 1];
      const outputNeuron = outputLayer[0];
      const currentError = Math.abs(outputNeuron.value - targetValue);

      // Check if we've reached the target
      if (currentError <= tolerance) {
        overallSuccess = true;
        break;
      }

      // Skip neurons that won't make any actual adjustments
      if (!willNeuronMakeAdjustments(neuron, targetValue, tolerance, learningRate)) {
        continue;
      }

      visitedAnyNeuron = true;

      // Get neuron position relative to network
      const neuronRect = neuron.element.getBoundingClientRect();
      const cursorTargetX = neuronRect.left + neuronRect.width / 2 - networkRect.left - 12;
      const cursorTargetY = neuronRect.top + neuronRect.height / 2 - networkRect.top - 12;

      // Move cursor to neuron
      await moveFakeCursorTo(cursorTargetX, cursorTargetY, 500);
      await sleep(150);

      // Click animation
      clickFakeCursor();
      await sleep(200);

      // Show neuron panel
      showNeuronPanel(neuron);
      if (neuron.controlsEl) {
        neuron.controlsEl.classList.add('neuron-controls--visible');
        activeControlNeuron = neuron;
      }
      await sleep(300);

      // Highlight the neuron
      highlightNeuron(neuron);

      // Adjust this neuron's incoming weights iteratively
      let neuronIterations = 0;
      while (neuronIterations < maxIterationsPerNeuron) {
        recomputeNetwork();
        const currentOutput = outputLayer[0].value;
        const error = currentOutput - targetValue;

        if (Math.abs(error) <= tolerance) {
          overallSuccess = true;
          break;
        }

        // Calculate gradients for this neuron's incoming connections
        const neuronGradients = computeNeuronGradients();
        let anyUpdate = false;

        for (const connection of neuron.incoming) {
          const gradient = connection.from.value * neuronGradients[neuron.layerIndex][neuron.index];
          if (!Number.isFinite(gradient) || gradient === 0) {
            continue;
          }
          const weightDelta = learningRate * error * gradient;
          if (weightDelta === 0) {
            continue;
          }
          const newWeight = Math.round((connection.weight - weightDelta) * 100) / 100;
          if (newWeight !== connection.weight) {
            connection.weight = newWeight;
            updateConnectionVisual(connection);
            anyUpdate = true;
          }
        }

        if (!anyUpdate) {
          break;
        }

        neuronIterations++;

        // Small delay to show the change visually (only every few iterations)
        if (neuronIterations % 5 === 0) {
          recomputeNetwork();
          await sleep(50);
        }
      }

      // Update panel content after adjustments
      recomputeNetwork();
      if (activeNeuron === neuron) {
        updateNeuronPanelContent(neuron);
      }

      await sleep(400);

      // Hide panel before moving to next neuron
      hideNeuronPanel();
      await sleep(200);

      if (overallSuccess) {
        break;
      }
    }

    // Move cursor out
    await moveFakeCursorTo(-40, networkRect.height / 2, 400);
    hideFakeCursor();

    // Re-enable button
    if (autoCorrectButtonEl) {
      autoCorrectButtonEl.classList.remove('layer-action--animating');
    }

    isAutoCorrectAnimating = false;

    // Final recompute - this will also update the button state via updateOutputPredictionLabel
    recomputeNetwork();

    // Check final result
    const finalOutputLayer = neuronsByLayer[neuronsByLayer.length - 1];
    const finalOutput = finalOutputLayer[0].value;
    const finalError = Math.abs(finalOutput - targetValue);
    overallSuccess = finalError <= tolerance;

    if (overallSuccess) {
      setStatus('Rejtett neuronok súlyai sikeresen beállítva!');
    } else if (!visitedAnyNeuron) {
      setStatus('Nincs beállítható neuron.');
    } else {
      setStatus('A javítás részlegesen sikerült.');
    }
  }

  function computeNeuronGradients() {
    const gradients = neuronsByLayer.map((layer) => layer.map(() => 0));
    const lastLayerIndex = neuronsByLayer.length - 1;
    if (lastLayerIndex < 0) {
      return gradients;
    }
    const outputLayer = neuronsByLayer[lastLayerIndex];
    outputLayer.forEach((_, neuronIndex) => {
      gradients[lastLayerIndex][neuronIndex] = 1;
    });

    for (let layerIndex = lastLayerIndex - 1; layerIndex >= 0; layerIndex -= 1) {
      const layer = neuronsByLayer[layerIndex];
      layer.forEach((neuron, neuronIndex) => {
        let gradientSum = 0;
        neuron.outgoing.forEach((connection) => {
          const targetLayerIndex = connection.to.layerIndex;
          gradientSum += connection.weight * gradients[targetLayerIndex][connection.to.index];
        });
        gradients[layerIndex][neuronIndex] = gradientSum;
      });
    }

    return gradients;
  }

  function adjustNetworkToTargetOutput(targetValue, options = {}) {
    if (!Number.isFinite(targetValue)) {
      return false;
    }
    const { limitToHiddenLayers = false } = options;
    const tolerance = 0.01;
    const maxIterations = 200;
    const learningRate = 0.03;
    let success = false;

    recomputeNetwork();

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const outputLayer = neuronsByLayer[neuronsByLayer.length - 1];
      if (!outputLayer.length) {
        break;
      }
      const outputNeuron = outputLayer[0];
      const error = outputNeuron.value - targetValue;
      if (Math.abs(error) <= tolerance) {
        success = true;
        break;
      }

      const neuronGradients = computeNeuronGradients();
      let anyUpdate = false;

      connections.forEach((connection) => {
        if (limitToHiddenLayers && connection.to.layerIndex === neuronsByLayer.length - 1) {
          return;
        }
        const gradient = connection.from.value * neuronGradients[connection.to.layerIndex][connection.to.index];
        if (!Number.isFinite(gradient) || gradient === 0) {
          return;
        }
        const weightDelta = learningRate * error * gradient;
        if (weightDelta === 0) {
          return;
        }
        connection.weight -= weightDelta;
        anyUpdate = true;
      });

      if (!anyUpdate) {
        break;
      }

      recomputeNetwork();
    }

    if (!success) {
      let finalOutput = 0;
      const lastLayer = neuronsByLayer[neuronsByLayer.length - 1];
      if (lastLayer && lastLayer.length) {
        finalOutput = lastLayer[0].value;
      }
      if (Math.abs(finalOutput - targetValue) <= tolerance) {
        success = true;
      }
    }

    connections.forEach((connection) => {
      updateConnectionVisual(connection);
    });

    return success;
  }

  function positionConnections() {
    const networkRect = networkEl.getBoundingClientRect();
    connections.forEach((connection) => {
      const fromRect = connection.from.element.getBoundingClientRect();
      const toRect = connection.to.element.getBoundingClientRect();

      const x1 = fromRect.left + fromRect.width / 2 - networkRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - networkRect.top;
      const x2 = toRect.left + toRect.width / 2 - networkRect.left;
      const y2 = toRect.top + toRect.height / 2 - networkRect.top;

      connection.line.setAttribute('x1', x1);
      connection.line.setAttribute('y1', y1);
      connection.line.setAttribute('x2', x2);
      connection.line.setAttribute('y2', y2);

      connection.midX = (x1 + x2) / 2;
      connection.midY = (y1 + y2) / 2;
      
      if (activeConnection === connection) {
        syncActiveOverlayFromLine(x1, y1, x2, y2);
      }
    });

    // Group overlapping handles and spread them out along their lines
    const overlapThreshold = 20; // Distance threshold for considering handles as overlapping
    const offsetDistance = 20; // Distance to offset along the connection line
    
    connections.forEach((connection) => {
      if (!connection.handleEl) return;
      
      // Calculate the line direction (unit vector)
      const fromRect = connection.from.element.getBoundingClientRect();
      const toRect = connection.to.element.getBoundingClientRect();
      const x1 = fromRect.left + fromRect.width / 2 - networkRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - networkRect.top;
      const x2 = toRect.left + toRect.width / 2 - networkRect.left;
      const y2 = toRect.top + toRect.height / 2 - networkRect.top;
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lineLength = Math.sqrt(dx * dx + dy * dy) || 1;
      const unitX = dx / lineLength;
      const unitY = dy / lineLength;
      
      // Find all handles that overlap with this one
      const overlappingHandles = connections.filter((other) => {
        if (!other.handleEl || other === connection) return false;
        const distX = other.midX - connection.midX;
        const distY = other.midY - connection.midY;
        const distance = Math.sqrt(distX * distX + distY * distY);
        return distance < overlapThreshold;
      });
      
      if (overlappingHandles.length > 0) {
        // Include the current connection in the group
        const handleGroup = [connection, ...overlappingHandles];
        const groupSize = handleGroup.length;
        
        // Find the index of the current connection in the sorted group (for consistent ordering)
        const sortedGroup = handleGroup.sort((a, b) => a.id - b.id);
        const currentIndex = sortedGroup.indexOf(connection);
        
        // Offset along the line: negative for first half, positive for second half
        const offsetFactor = currentIndex - (groupSize - 1) / 2;
        const offset = offsetFactor * offsetDistance;
        
        const handleX = connection.midX + unitX * offset;
        const handleY = connection.midY + unitY * offset;
        
        connection.handleEl.style.left = `${handleX - 7}px`;
        connection.handleEl.style.top = `${handleY - 7}px`;
      } else {
        // No overlap, position directly at midpoint
        connection.handleEl.style.left = `${connection.midX - 7}px`;
        connection.handleEl.style.top = `${connection.midY - 7}px`;
      }
    });

    if (activeConnection) {
      placeWeightPanel(activeConnection);
    }
    if (activeNeuron) {
      placeNeuronPanel(activeNeuron);
    }
  }

  function placeWeightPanel(connection) {
    if (!connection || weightPanel.style.display === 'none') {
      return;
    }
    const padding = 16;
    const panelWidth = weightPanel.offsetWidth;
    const panelHeight = weightPanel.offsetHeight;
    const maxLeft = networkEl.clientWidth - panelWidth - padding;
    const maxTop = networkEl.clientHeight - panelHeight - padding;

    let left = connection.midX - panelWidth / 2;
    let top = connection.midY - panelHeight - 20;

    if (top < padding) {
      top = connection.midY + 20;
    }

    left = Math.max(padding, Math.min(left, maxLeft));
    top = Math.max(padding, Math.min(top, maxTop));

    weightPanel.style.left = `${left}px`;
    weightPanel.style.top = `${top}px`;
  }

  function placeNeuronPanel(neuron) {
    if (!neuron || neuronPanel.style.display === 'none') {
      return;
    }
    const padding = 16;
    const panelWidth = neuronPanel.offsetWidth;
    const panelHeight = neuronPanel.offsetHeight;
    const networkRect = networkEl.getBoundingClientRect();
    const neuronRect = neuron.element.getBoundingClientRect();

    const centerX = neuronRect.left + neuronRect.width / 2 - networkRect.left;
    const centerY = neuronRect.top + neuronRect.height / 2 - networkRect.top;

    let left = centerX + 60;
    let top = centerY - panelHeight / 2;

    const maxLeft = networkEl.clientWidth - panelWidth - padding;
    const maxTop = networkEl.clientHeight - panelHeight - padding;

    if (left > maxLeft) {
      left = centerX - panelWidth - 60;
    }

    left = Math.max(padding, Math.min(left, maxLeft));
    top = Math.max(padding, Math.min(top, maxTop));

    neuronPanel.style.left = left + 'px';
    neuronPanel.style.top = top + 'px';
  }

  function buildNeuronExpression(neuron) {
    if (!neuron.incoming.length) {
      return {
        lines: [],
        summaryParts: [],
        note: 'Ez a neuron rögzített bemeneti értéket tart: ' + formatNumber(neuron.value) + '.'
      };
    }

    const lines = neuron.incoming.map((connection) => ({
      term: formatNumber(connection.lastInput) + ' * ' + formatNumber(connection.weight),
      result: formatNumber(connection.lastContribution),
      connectionId: connection.id
    }));

    const summaryParts = neuron.incoming.map((connection) => formatNumber(connection.lastInput) + ' * ' + formatNumber(connection.weight));

    return {
      lines,
      summaryParts,
      note: ''
    };
  }

  function updateNeuronPanelContent(neuron) {
    neuron.incoming.forEach((connection) => {
      connection.isExpressionHover = false;
      refreshConnectionStroke(connection);
    });

    const expression = buildNeuronExpression(neuron);
    neuronPanelTitle.textContent = neuron.titleEl.textContent;
    neuronOutputValueEl.textContent = formatNumber(neuron.value);

    if (expression.note) {
      neuronExpressionEl.innerHTML = '<div class="neuron-expression-note">' + expression.note + '</div>';
      return;
    }

    const lineMarkup = expression.lines
      .map((entry) => '<div class="neuron-expression-line" data-connection-id="' + entry.connectionId + '"><span>' + entry.term + '</span><span>' + entry.result + '</span></div>')
      .join('');

    const summaryText = expression.summaryParts.join(' + ');
    neuronExpressionEl.innerHTML =
      '<div class="neuron-expression-list">' + lineMarkup + '</div>' +
      '<div class="neuron-expression-summary">' + summaryText + ' = <strong>' + formatNumber(neuron.value) + '</strong></div>';

    const expressionLines = neuronExpressionEl.querySelectorAll('.neuron-expression-line');
    expressionLines.forEach((lineEl) => {
      const idAttr = lineEl.getAttribute('data-connection-id');
      if (!idAttr) {
        return;
      }
      const connection = connections[Number(idAttr)];
      if (!connection) {
        return;
      }
      lineEl.addEventListener('mouseenter', () => {
        connection.isExpressionHover = true;
        lineEl.classList.add('neuron-expression-line--active');
        refreshConnectionStroke(connection);
      });
      lineEl.addEventListener('mouseleave', () => {
        connection.isExpressionHover = false;
        lineEl.classList.remove('neuron-expression-line--active');
        refreshConnectionStroke(connection);
      });
    });
  }

  function showNeuronPanel(neuron) {
    hideWeightPanel();
    activeNeuron = neuron;
    updateNeuronPanelContent(neuron);
    neuronPanel.style.display = 'flex';
    setStatus(`Neuron megnyitva: ${neuron.titleEl.textContent}`);
    requestAnimationFrame(() => {
      placeNeuronPanel(neuron);
    });
  }

  function hideNeuronPanel() {
    hideHiddenNeuronControls();
    if (activeNeuron) {
      activeNeuron.incoming.forEach((connection) => {
        if (connection.isExpressionHover) {
          connection.isExpressionHover = false;
          refreshConnectionStroke(connection);
        }
      });
    }
    neuronExpressionEl.querySelectorAll('.neuron-expression-line--active').forEach((lineEl) => {
      lineEl.classList.remove('neuron-expression-line--active');
    });
    activeNeuron = null;
    neuronPanel.style.display = 'none';
  }

  function showWeightPanel(connection) {
    hideNeuronPanel();
    hideHiddenNeuronControls();
    setActiveConnection(connection);
    weightPanelTitle.textContent = connection.label;
    weightValueEl.textContent = formatNumber(connection.weight);
    weightPanel.style.display = 'flex';
    requestAnimationFrame(() => {
      placeWeightPanel(connection);
    });
  }

  function hideWeightPanel() {
    setActiveConnection(null);
    weightPanel.style.display = 'none';
  }

  function attachEventHandlers() {
    weightAdjustButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const delta = Number(button.getAttribute('data-delta'));
        if (!Number.isFinite(delta) || !activeConnection) {
          return;
        }
        applyWeightChange(activeConnection, delta);
      });
    });

    weightCloseBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      hideWeightPanel();
    });

    weightPanel.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    neuronCloseBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      hideNeuronPanel();
    });

    neuronPanel.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    svgEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || typeof target.getAttribute !== 'function') {
        return;
      }
      if (String(target.tagName).toLowerCase() !== 'line') {
        return;
      }
      event.stopPropagation();
      const idAttr = target.getAttribute('data-connection-id');
      if (!idAttr) {
        return;
      }
      const connection = connections[Number(idAttr)];
      if (connection) {
        showWeightPanel(connection);
      }
    });

    networkEl.addEventListener('click', () => {
      if (activeConnection) {
        hideWeightPanel();
      }
      if (activeNeuron) {
        hideNeuronPanel();
      }
      hideHiddenNeuronControls();
    });

    document.addEventListener('click', () => {
      hideHiddenNeuronControls();
    });

    if (shuffleButtonEl) {
      shuffleButtonEl.addEventListener('click', (event) => {
        event.stopPropagation();
        randomizeInputs();
      });
    }

    if (autoCorrectButtonEl) {
      autoCorrectButtonEl.addEventListener('click', (event) => {
        event.stopPropagation();
        handleAutoCorrectRequest();
      });
    }

  }

  function makeDraggable(panelEl, handleEl) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handleEl.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - panelEl.offsetLeft;
      offsetY = e.clientY - panelEl.offsetTop;
      panelEl.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      panelEl.style.left = `${x}px`;
      panelEl.style.top = `${y}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      panelEl.style.userSelect = '';
    });
  }

  function init() {
    buildLayers();
    buildConnections();
    svgEl.appendChild(connectionOverlayLayer);
    loadRandomPetImage();
    recomputeNetwork();
    attachEventHandlers();
    positionConnections();
    makeDraggable(neuronPanel, neuronPanel.querySelector('.panel-header'));
    window.addEventListener('resize', () => {
      window.requestAnimationFrame(positionConnections);
    });
  }

  window.addEventListener('load', () => {
    init();
    window.requestAnimationFrame(positionConnections);
  });
})();
  
