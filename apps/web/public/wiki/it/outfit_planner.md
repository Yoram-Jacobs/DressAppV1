# Pianificatore Outfit & Canvas

Componi, sovrapponi e rivedi layout coordinati.

## Panoramica
Il Pianificatore Outfit fornisce un canvas di avatar 2D visivo (che supporta sia i ritagli di foto reali del corpo dell'utente sia i manichini vettoriali dinamici SVG) con offset di punti di riferimento calibrati (`top-[14.5%]` da colletto a scollatura e `top-[36.5%]` da cintola a vita) per sovrapporre capi superiori, inferiori, capispalla e calzature perfettamente aderenti ai contorni del corpo.

## Requisiti preliminari
- Articoli salvati nell'armadio.

## Passo dopo passo
1. **Seleziona canvas**: Apri il Pianificatore e fai clic su un giorno o su una nuova bozza.
2. **Sovrapponi articoli**: Trascina i vestiti sull'avatar 2D. I capispalla si sovrappongono automaticamente sopra le magliette interne.
3. **Valuta la vestibilità**: Controlla i punteggi di compatibilità e gli avvisi (ad es. conflitti di colore o avvisi meteo).
4. **Salva**: Imposta un titolo e programma il look nel tuo diario del guardaroba. Gli aggiornamenti vengono trasmessi in modo thread-safe tramite `useOutfitStore`.

## Risultati attesi
Composizioni di outfit sovrapposte con eleganza salvate nel tuo calendario e visibili come anteprime di schede a griglia senza cicli di polling delle richieste di rete in background.

## Risoluzione dei problemi
- **Ordine dei livelli errato**: Riverifica la categoria dell'articolo; i capispalla devono essere classificati come "Outerwear" per sovrapporsi correttamente.
- **Avvisi di sovrapposizione**: Se l'avatar avverte di capi ripetuti, controlla se hai indossato lo stesso outfit nello stesso luogo di recente.

## Limitazioni
- I livelli sono gestiti automaticamente in base ai tag di categoria; le sovrascritture manuali di z-index non sono supportate.