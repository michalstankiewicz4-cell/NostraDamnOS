// Ładowanie modeli AI
async function handleLoadModels() {
    console.log('🎯 handleLoadModels called!');
    
    const btn = document.getElementById('loadModels');
    if (!btn) {
        console.error('❌ Button loadModels not found!');
        alert('Błąd: Nie znaleziono przycisku!');
        return;
    }
    
    console.log('✅ Button found:', btn);
    btn.disabled = true;
    btn.textContent = 'Ładowanie modeli...';
    
    try {
        // Ładowanie Transformers.js
        console.log('📦 Loading Transformers.js...');
        updateModelStatus('transformersStatus', 'loading');
        await initNLP();
        state.modelsLoaded.transformers = true;
        updateModelStatus('transformersStatus', 'ready');
        console.log('✅ Transformers.js loaded!');
        
        // Ładowanie WebLLM
        console.log('📦 Loading WebLLM...');
        updateModelStatus('webllmStatus', 'loading');
        await initWebLLM();
        state.modelsLoaded.webllm = true;
        updateModelStatus('webllmStatus', 'ready');
        console.log('✅ WebLLM loaded!');
        
        enableAnalysisButtons();
        btn.textContent = '✅ Modele załadowane';
        alert('✅ Modele załadowane pomyślnie!');
        
    } catch (error) {
        console.error('❌ Błąd ładowania modeli:', error);
        alert(`❌ Błąd: ${error.message}`);
        showError('Nie udało się załadować modeli AI');
        btn.disabled = false;
        btn.textContent = 'Spróbuj ponownie';
    }
}
