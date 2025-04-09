## **NOME TOOL:**  
**DividiSpese – Il Calcolatore Intelligente per Gruppi**

---

## **OBIETTIVO DEL TOOL:**  
Aiutare gruppi di persone (amici, coinquilini, colleghi, famiglie in viaggio) a **tenere traccia delle spese condivise** e calcolare **chi deve quanto a chi** in modo chiaro, preciso e senza malintesi.

---

## **TARGET UTENTE:**  
- Gruppi di amici in vacanza  
- Coinquilini  
- Coppie che dividono le spese  
- Colleghi che organizzano eventi o pranzi  
- Famiglie che gestiscono le spese comuni

---

## **PROBLEMA CHE RISOLVE:**  
Gestire manualmente chi ha pagato cosa e fare i conti è difficile, noioso, e spesso crea tensioni o confusione. Il tool:
- Automatizza i calcoli
- Mantiene trasparenza nei gruppi
- Evita discussioni
- Aiuta a “chiudere i conti” in modo equo

---

## **FUNZIONALITÀ CORE (ESSENZIALI):**

### **1. Creazione di un Gruppo Spese**
- Nome del gruppo (es. "Vacanza in Puglia 2025")
- ID univoco + link condivisibile (es. `dividispese.it/g/abc123`)
- Autenticazione opzionale (via email/Google o accesso guest)

### **2. Gestione Partecipanti**
- Aggiunta/rimozione partecipanti
- Nome + (opzionale) email per inviti
- Ogni partecipante ha un colore assegnato per distinguere facilmente

### **3. Aggiunta Spese**
- Form intuitivo:  
  - Chi ha pagato  
  - Importo (€)  
  - Cosa è stato pagato (es. "Cena al ristorante")  
  - Selezione: per chi è stata la spesa (tutti o selezionati)
  - Data della spesa
- Aggiunta veloce con tasti di scelta rapida

### **4. Calcolo Automatico Saldi**
- Mostra:
  - Totale speso da ciascun partecipante
  - Totale dovuto (spesa equa)
  - Differenza (saldo finale)
- Generazione automatica delle transazioni tipo:  
  “Marco deve 17,50 € a Giulia”

### **5. Riepilogo Visuale e Statistiche**
- Grafico a torta delle spese totali per persona
- Timeline spese con filtri per giorno/categoria
- Grafico “chi ha anticipato di più”

---

## **FUNZIONALITÀ AVANZATE (PLUS):**

### **6. Sincronizzazione Cloud (tramite Supabase o DB alternativo)**
- Ogni modifica è salvata in tempo reale
- Più utenti possono aggiungere spese in contemporanea

### **7. Inviti al Gruppo**
- Invita altri partecipanti via email/link
- Controllo dei permessi: admin o solo visualizzazione

### **8. Categorie Personalizzate**
- Alloggio, Cibo, Trasporti, Attività, Altro…
- Filtro per categorie nel riepilogo

### **9. Multivaluta (opzionale)**
- Imposta valuta del gruppo
- Conversione automatica con tasso aggiornato (per gruppi internazionali)

### **10. Esportazione e Backup**
- Esporta riepilogo in:
  - PDF (per tenerlo come ricevuta finale)
  - CSV (per Excel/Google Sheets)
- Backup automatico nel profilo utente

### **11. Notifiche Intelligenti**
- Promemoria: "Hai una spesa in sospeso"
- Notifica: "Francesco ha aggiunto una nuova spesa"

---

## **UI/UX GUIDELINES**
- Mobile-first, responsive
- UI moderna ma ultra-semplice (tipo Notion o Splitwise)
- Nessuna registrazione obbligatoria per l’uso base
- Feedback visivo chiaro dopo ogni azione
- Navigazione laterale con: "Spese", "Partecipanti", "Riepilogo", "Impostazioni"

---

## **TO DO TECNICO PER SVILUPPO**
- Frontend: React (oppure HTML/JS Vanilla per MVP), Tailwind o Bootstrap
- Backend: Supabase o Node.js + PostgreSQL
- Hosting: Vercel/Netlify (frontend), Supabase o Render (backend)
- Autenticazione: Magic link, Google login o accesso guest

---

## **FATTORI DIFFERENZIANTI / USP**
- **Nessuna registrazione obbligatoria** per iniziare
- **Interfaccia minimal** ma potente
- Possibilità di **gestire spese tra sotto-gruppi**
- **PDF riepilogativo finale** da condividere nel gruppo
- Pensato **per l’uso in gruppo**, ma anche semplice da usare in coppia

---

## **MONETIZZAZIONE FUTURA (facoltativa):**
- Versione Pro con:
  - Backup in cloud illimitato
  - Accesso multi-dispositivo
  - Report PDF personalizzati con logo/nome evento
  - Widget embeddabile
- Sponsorizzazione link PayPal/Stripe per ricevere soldi facilmente nel gruppo