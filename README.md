# Readme Project Web Programming

## Checklist:
0. overkoepelend.

    - [ ] renderd mooi op mobile

1. Individueel.

    - [x] Account aanmaken 
    - [x] inloggen
    - [x] Profiel aanmaken/aanpassen
    - [x] Wachtwoordenhashing

    extra:
    - [ ] registreren logt ook automatisch in
    - [x] oogje om naar wachtwoord te kijken terwijl je het invult
    - [ ] profielfotos
    - [x] wachtwoord 2 keer ingeven bij registreren en vergelijken

2. sociaal.

    - [x] Vrienden toevoegen
    - [x] Vrienden verwijderen
    - [x] reisgroep aanmaken
    - [x] rechten binnen groep beheren (via rollen? beheerder, lid, etc)

    extra:
    - [x] vrienden systeem ombouwen naar request-systeem

3. De reis plannen

    - [x] Reis aanmaken (individueel of met groep)
    - [x] Stops toevoegen
    - [ ] checking of stops niet overlappen
    - [ ] Indien groep, stops voorstellen en stemming laten gebeuren
    - [ ] Reis voorstellen op kaart (google maps api integratie?)
    - [ ] tickets uploaden
    - [ ] reis-planning downloaden als text file

4. Tijdens de reis.

    - [ ] overzicht persoonlijke dagplanning (los van groepen) 
    - [ ] tickets/vouchers per activiteit bekijken
    - [ ] Dit moet allemaal offline kunnen?

5. Na de reis.

    - [ ] Reis toevoegen aan website als template voor andere gebruikers samen met een review + geuploade fotos

6. Diverse extras.

    - [ ] mooiere error pages (email in gebruik, user not found, ...)
    - [ ] budgetmanagement (uitgaves toevoegen per persoon, eventueel met categorien)
    - [ ] Budgetanalyse (overzicht van wie wat heeft betaald)
    - [ ] Terugbetalingsberekening (optie om te berekenen wat iedereen elkaar terug moet betalen)
    - [ ] admin accounts-systeem die accounts kan verwijderen/editen etc
    - [ ] functionaliteit om meer vrienden te zoeken

## Gebruikte APIs met huidige planning:

1. Browser APIs:
    - [File API](https://www.example.com)
    - [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
    - [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) voor offline gebruik?

2. Externe APIs:
    - Google maps of alternatieve
    - misschien een api voor het weer?
    - [x] [Photon api](https://photon.komoot.io/)
    
    
