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
    - [x] profielfotos
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
    - [x] checking of stops niet overlappen
    - [x] Indien groep, stops voorstellen en stemming laten gebeuren
    - [x] Reis voorstellen op kaart
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
    - [ ] admin accounts-systeem die accounts kan verwijderen/editen etc
    - [ ] functionaliteit om meer vrienden te zoeken
    - [ ] lettertjes in de groepen zijn profielfotos
    - [ ] default profiel foto fixen (renderd momenteel niet)

7. Final bugchecks!!!!.

    - [ ] checken voor text format issues

## Gebruikte APIs met huidige planning:

1. Browser APIs:
    - [File API](https://www.example.com)
    - [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
    - [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) voor offline gebruik?

2. Externe APIs:
    - [x] [Leaflet met OSM*](https://leafletjs.com/)
    - [x] [Photon api](https://photon.komoot.io/)
    - misschien een api voor het weer?

* Leaflet is zelf geen API, maar maakt gebruik van OSM api om map data te verkrijgen
    
    
