# Pianificazione mattutina e avvisi push

Inizi la giornata con consigli di stile automatici e adatti al meteo, inviati direttamente sul suo dispositivo.

## Panoramica
Il Pianificatore Mattutino automatizza la scelta dei suoi outfit inviando suggerimenti di stile personalizzati ogni mattina. Controlla le previsioni del tempo locali e le sue attività quotidiane (tramite Google Calendar) per generare tre opzioni abbinate. Tocchi la notifica per visualizzare le opzioni sul suo avatar personale, salvare la scelta preferita e visualizzare istantaneamente i punteggi di compatibilità meteo.

## Prerequisiti
- **Notifiche consentite**: Le notifiche push devono essere abilitate per DressApp nelle impostazioni del dispositivo o del browser.
- **Articoli nel guardaroba**: Deve aver caricato nel guardaroba almeno un sopra (top), un sotto (bottom) e una calzatura.
- **Google Calendar**: Un account Google Calendar collegato (opzionale, ma consigliato per rendere i suggerimenti consapevoli degli eventi).
- **Chiave Gemini**: Una chiave API Gemini personalizzata configurata nelle impostazioni.

## Istruzioni passo dopo passo
1. **Abilitare gli avvisi**: Vada su **Impostazioni profilo** -> **Pianificatore e avvisi push**. Attivi l'interruttore delle notifiche.
2. **Impostare l'orario**: Imposti l'ora e il minuto esatti in cui desidera ricevere il suggerimento (ad es. 07:30).
3. **Collegare il calendario**: Nelle Impostazioni del calendario, colleghi il suo account Google Calendar in modo che l'IA conosca i suoi impegni.
4. **Aprire il suggerimento**: Quando arriva l'avviso push del mattino, faccia clic su di esso. Verrà indirizzato direttamente alla scheda **Suggerimento giornaliero** (Match) sotto la voce **Stylist**.
5. **Visualizzare le opzioni**: Il selettore **Pianifica outfit** si aprirà automaticamente, mostrando le sue tre combinazioni di stile direttamente sul suo avatar.
6. **Salvare e verificare**: Tocchi uno dei suggerimenti giornalieri per pianificarlo sul suo calendario. L'app salverà l'outfit e aprirà immediatamente un pannello dei dettagli che mostra le metriche di compatibilità meteo (armonia dei colori, adattamento alla temperatura e coerenza dello stile).

## Risultati attesi
Una notifica viene recapitata ogni giorno all'ora scelta. Facendo clic su di essa si apre l'app, vengono mostrate tre opzioni sull'avatar e si consente di salvarne una sul calendario con tutti i dettagli sulla compatibilità.

## Risoluzione dei problemi
- **Nessuna notifica in arrivo**: 
  - Si assicuri che le notifiche siano consentite per il sito web DressApp nelle impostazioni del sito del browser o nelle impostazioni del sistema operativo.
  - Verifichi che il dispositivo non sia in modalità "Non disturbare" o "Focus" durante l'orario pianificato per la notifica.
- **Capi di abbigliamento mancanti sull'avatar**: 
  - Si assicuri di avere capi in tutte le categorie di base (sopra, sotto, scarpe) nel guardaroba in modo che il pianificatore possa vestire l'avatar correttamente.
- **Consigli generici**: 
  - Colleghi il suo Google Calendar in modo che i suggerimenti corrispondano ai suoi specifici eventi quotidiani.

## Limitazioni
- È possibile pianificare fino a un outfit al giorno sul proprio calendario.
- Gli aggiornamenti meteo richiedono una connessione Internet attiva sul server.
