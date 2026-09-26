# Assistente per la valigia

Preparate la valigia in modo efficiente e senza stress per qualsiasi destinazione con previsioni meteo guidate dall'IA e perfezionamento interattivo della checklist tramite chat.

## Panoramica
L'Assistente per la valigia elimina l'ansia dei preparativi di viaggio analizzando il vostro itinerario, il meteo a destinazione e il catalogo del vostro guardaroba personale per creare una checklist personalizzata giorno per giorno. Basato su **Google Gemini 3.5 Flash-Lite** tramite `llm_gateway.py`, l'assistente genera piani completi per la valigia in pochi secondi e vi consente di perfezionare gli articoli conversando in chat in modo interattivo.

## Prerequisiti
- Nome della città di destinazione e date di partenza e ritorno.
- Un inventario attivo nell'armadio con almeno alcuni capi essenziali.
- Connessione a Internet per scaricare le previsioni meteo della destinazione.

## Istruzioni passo dopo passo
1. **Creare un viaggio**: Aprite la scheda Valigia, toccate **Nuovo viaggio** e inserite la città di destinazione, le date di inizio e fine e lo scopo del viaggio (ad esempio, *Lavoro*, *Vacanze al mare*, *Giro turistico informale*).
2. **Generare il piano per la valigia**: Toccate **Genera checklist**. L'IA recupera le temperature e le condizioni previste per la destinazione, confronta i capi presenti nel vostro armadio ed elabora una lista equilibrata.
3. **Controllare gli outfit giornalieri**: Esaminate le combinazioni suggerite giorno per giorno, assicurandovi strati adeguati per le mattine fresche e i pomeriggi più caldi.
4. **Perfezionare tramite chat**: Avete bisogno di alternative? Chattate direttamente con l'assistente per la valigia (ad esempio, *"Aggiungi scarpe da ginnastica comode per camminare"* oppure *"Includi un abito da cocktail per cena"*). La checklist si aggiorna dinamicamente.
5. **Spuntare i capi preparati**: Utilizzate le caselle di controllo interattive man mano che preparate i bagagli per tenere traccia di ciò che avete già messo in valigia.
6. **Salvare per l'accesso offline**: Salvate il piano di viaggio completato per accedervi in modo rapido e ottimistico sul dispositivo anche quando siete offline durante gli spostamenti.

## Risultati attesi
Una checklist per la valigia completa e ottimizzata in base al meteo, organizzata per categorie di abbigliamento (top, pantaloni/gonne, capispalla, scarpe, capi essenziali), senza capi duplicati o superflui.

## Risoluzione dei problemi
- **Previsioni meteo non disponibili**: Verificate l'ortografia della città di destinazione; per le località secondarie, provate a specificare la città principale più vicina.
- **La checklist include pochi capi**: Assicuratevi di aver caricato nel guardaroba un numero sufficiente di capi adatti alla stagione e alle temperature previste a destinazione.
- **Le modifiche non vengono salvate**: Verificate che la connessione di rete sia attiva quando aggiungete note personalizzate in chat.

## Limitazioni
- Le previsioni meteo automatiche coprono viaggi pianificati fino a 14 giorni di anticipo; per i viaggi oltre questa soglia vengono utilizzate le medie climatiche stagionali storiche.