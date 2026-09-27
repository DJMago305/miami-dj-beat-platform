/* Academia · courses.html — bilingüe (PO 2026-09-27: «traduce courses.html completo»).
 * - mdjCT(es, en): texto según la perilla ES/EN del header (i18n.currentLang; por defecto inglés como el resto del sitio).
 * - mdjBindQ(arr, clave, rerender): el banco de preguntas de cada módulo se escribe en español en courses.html (texto canónico);
 *   aquí vive la versión en inglés. El arreglo se intercambia EN SITIO al cambiar de idioma (misma referencia, mismo orden, mismas
 *   respuestas correctas) y se repinta la pregunta actual si no está contestada. */
(function () {
  'use strict';
  function lang() {
    try { if (window.i18n && window.i18n.currentLang) return window.i18n.currentLang; } catch (e) { /* sin i18n */ }
    try { return localStorage.getItem('mdjpro_lang') || 'en'; } catch (e) { return 'en'; }
  }
  window.mdjCT = function (es, en) { return lang() === 'en' ? en : es; };
  var EN = {
 "Q3": [
  {
   "q": "What is the main mistake of organizing music only by artist or album?",
   "opts": [
    "It takes up too much hard drive space",
    "It isn't optimized for live use — it makes it hard to find tracks by energy function",
    "It's hard to export to USB",
    "It doesn't let you calculate BPM automatically",
    "It only works in Rekordbox, not in Serato"
   ],
   "ans": 1
  },
  {
   "q": "What is the maximum time a professional DJ should take to find a track in the booth?",
   "opts": [
    "20 seconds",
    "15 seconds",
    "10 seconds",
    "5 seconds",
    "Any amount of time is fine as long as the track sounds good"
   ],
   "ans": 3
  },
  {
   "q": "How should the macro folders in a professional library be organized?",
   "opts": [
    "Alphabetically by artist",
    "By the track's release year",
    "By album and record label",
    "By energy function and live use (WARM UP, PEAK, EMERGENCY, etc.)",
    "By chronological order of purchase"
   ],
   "ans": 3
  },
  {
   "q": "What is the difference between a regular Crate and a Smart Crate in Serato?",
   "opts": [
    "A Smart Crate only works with tracks in .WAV format",
    "Regular Crates are for genres, Smart Crates are only for private events",
    "A Smart Crate fills itself automatically based on rules you define for BPM, genre and comments",
    "Smart Crates are backup crates synced to the cloud",
    "There's no functional difference, only the icon on screen changes"
   ],
   "ans": 2
  },
  {
   "q": "Why is it recommended to number your Crates in Serato (01_WarmUp, 02_Build, etc.)?",
   "opts": [
    "Because Serato only allows 9 crates per session",
    "So they appear sorted by energy function instead of alphabetically",
    "Because CDJs read the numbers before the names",
    "To make automatic export to Rekordbox easier",
    "It's just an aesthetic preference with no functional impact"
   ],
   "ans": 1
  },
  {
   "q": "Before playing live, a track must have, without exception:",
   "opts": [
    "Just the software's automatic BPM",
    "Structured hot cues (Intro, Drop, Break, Outro) and a corrected beatgrid",
    "Just the key detected by the algorithm",
    "The album artwork properly updated",
    "The track marked as a favorite in the library"
   ],
   "ans": 1
  },
  {
   "q": "What is the strategic function of the 'Comments' field in a track's metadata?",
   "opts": [
    "To indicate the producer's name and record label",
    "To record the purchase date and original price",
    "To store tactical notes like 'Latin floor filler' or 'Perfect transition 124→128'",
    "To flag whether the track has restricted copyright",
    "To note how many times you've played it in the last month"
   ],
   "ans": 2
  },
  {
   "q": "What are the 4 correctly structured Hot Cues in professional track prep?",
   "opts": [
    "A, B, C, D in your personal listening order",
    "Clean intro, Drop, Break, Outro",
    "Verse, Chorus, Bridge, Ending",
    "Low, mid, high BPM and peak",
    "Vocal, Instrumental, Loop ready, Out point"
   ],
   "ans": 1
  },
  {
   "q": "What is the difference between a Playlist and an Intelligent Playlist in Rekordbox?",
   "opts": [
    "Intelligent Playlists have better audio quality",
    "Regular ones are for House and Intelligent ones are for EDM",
    "An Intelligent Playlist updates automatically based on rules for BPM, Key, Rating and Genre",
    "Intelligent Playlists require a permanent internet connection",
    "There's no real difference between the two in Rekordbox"
   ],
   "ans": 2
  },
  {
   "q": "What are 'My Tags' in Rekordbox and why are they useful in a CDJ booth?",
   "opts": [
    "Mandatory copyright tags for using tracks in licensed venues",
    "Time markers saved automatically by the software",
    "Custom tags (Warm Up, Peak, After, etc.) that give an instant visual read of the energy on the CDJ",
    "Voice notes the DJ can listen to during the set",
    "Sync tags between Serato and Rekordbox"
   ],
   "ans": 2
  },
  {
   "q": "Why does the professional NOT export the entire library to USB?",
   "opts": [
    "Because USB drives have a limit of 500 tracks per device",
    "Because a full export takes more than 8 hours",
    "Because they use themed USB drives with only what's needed for the event — operational discipline",
    "Because Pioneer CDJs can't read more than 3 genres per USB",
    "Because mixing genres on the same USB reduces audio quality"
   ],
   "ans": 2
  },
  {
   "q": "What advantage does it give a DJ to pre-organize the hard drive BEFORE importing into Rekordbox?",
   "opts": [
    "It lets you use older-generation Pioneer CDJs",
    "It prevents metadata errors in the library and makes library management easier",
    "It unlocks Rekordbox premium features at no extra cost",
    "It lets you export to Serato automatically with no setup",
    "It only matters if you export to more than 3 USB drives at once"
   ],
   "ans": 1
  },
  {
   "q": "Which of these tasks can be automated with modern music organization tools?",
   "opts": [
    "Choosing the right track for each moment of the set",
    "Reading the crowd's emotional state in real time",
    "Bulk correction of BPM, Key and metadata, duplicate removal and energy classification",
    "Syncing the lighting system with the track's drop",
    "Automatically programming the entire set with no DJ input"
   ],
   "ans": 2
  },
  {
   "q": "Why is removing duplicates critical for professional performance?",
   "opts": [
    "Because duplicates take up space and create confusion, slowing down search speed in the booth",
    "Because CDJs charge a penalty for duplicate files",
    "Because the duplicate always has lower audio quality than the original",
    "Because Serato locks up when it detects duplicates",
    "Duplicates don't affect performance, they're only an aesthetic problem"
   ],
   "ans": 0
  },
  {
   "q": "How can an external music organization app fit into the DJ's professional workflow?",
   "opts": [
    "As a complete replacement for Serato and Rekordbox",
    "Only as a tool for beginner DJs with no technical experience",
    "As a pre-processor: it cleans, classifies and normalizes the library before importing into the DJ software",
    "As a system for streaming tracks directly to the CDJ",
    "As an audio editor for making mixes before the set"
   ],
   "ans": 2
  },
  {
   "q": "You're at an Open Format club. You're coming out of Hip Hop at 95 BPM and need to move up to House at 124 BPM without losing the dance floor. What's the right strategy?",
   "opts": [
    "Jump the BPM straight from 95 to 124 with a clean cut on the drop",
    "Use a transition track at an intermediate BPM, a strategic loop or an acapella to bridge the ranges without a break",
    "Bring the volume down to zero and restart at the new BPM",
    "Play two songs at once, blending genres in parallel",
    "Ask the crowd to wait while you adjust the BPM manually"
   ],
   "ans": 1
  },
  {
   "q": "The club's WiFi goes down and you were relying on streaming to access your library. What does that show?",
   "opts": [
    "That the club failed to meet the rider's technical requirements",
    "That streaming is enough for professional events under normal conditions",
    "That your setup wasn't prepared — a professional always has a local library on USB with tested tracks",
    "That Pioneer needs to update the technology in its CDJs",
    "That it's a force majeure problem outside the DJ's control"
   ],
   "ans": 2
  },
  {
   "q": "A DJ tells you: 'I don't prep my tracks before the set, I improvise everything in the booth.' What does that indicate?",
   "opts": [
    "That they're a high-level DJ who trusts their musical instinct",
    "That they have a perfect library with no need for technical prep",
    "That they risk beatgrid errors, long intros and slow searches — a lack of a professional system",
    "That they use Ableton Live instead of Serato or Rekordbox",
    "That their artistic style doesn't require any technical prep beforehand"
   ],
   "ans": 2
  },
  {
   "q": "What fundamental difference separates an amateur DJ from a professional DJ when it comes to their library?",
   "opts": [
    "The professional DJ has over 100,000 tracks — the amateur has fewer than 1,000",
    "The professional DJ uses more expensive, higher-quality gear",
    "The amateur DJ hoards music; the professional DJ builds a system with purpose and function",
    "The professional DJ always uses Rekordbox; the amateur always uses Serato",
    "The professional DJ never listens to new music — they only work with proven classics"
   ],
   "ans": 2
  },
  {
   "q": "Which of the following best describes the professional DJ mindset of Module 3?",
   "opts": [
    "Creative artist who improvises everything with no structure or prior prep",
    "Music collector who accumulates as many tracks as possible",
    "Technician + Curator + Data engineer + Entrepreneur with an organized booth ecosystem",
    "Specialist in a single software with no need to adapt to others",
    "Performer who relies solely on natural crowd-reading talent"
   ],
   "ans": 2
  }
 ],
 "Q5": [
  {
   "q": "What is the standard structure of an electronic club track?",
   "opts": [
    "Verse, Chorus, Bridge, Ending",
    "Clean intro, Main section, Build-up, Drop, Breakdown, Drop 2, Outro",
    "Just a repeated Drop with a fade-out",
    "Intro, Guitar solo, Chorus, Ending",
    "Low, mid and high BPM"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'clean intro' of a track and why is it critical for the DJ?",
   "opts": [
    "The most melodic part of the track",
    "The percussion/kick-only section with no melodic elements — it lets you mix without harmonic conflict or vocal clashes",
    "The musical title before the first verse",
    "The artist's vocal introduction",
    "The loudest beat of the track"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'breakdown' of an electronic track?",
   "opts": [
    "A technical error in the software",
    "The section where the drop is pulled back to build tension and prepare the crowd for the next peak",
    "The point where the DJ changes tracks",
    "The moment where the track ends completely",
    "The main drop of the track"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'build-up' in a track?",
   "opts": [
    "A beatmatching error",
    "The crescendo section with risers, rising filters and accelerating percussion that leads into the drop",
    "The fade-out at the end of the track",
    "A filter transition between songs",
    "The outro of the track"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'drop' in an electronic track?",
   "opts": [
    "The point where the volume goes down completely",
    "The moment of maximum impact where all the elements return at full energy after the build-up",
    "The start of the track",
    "The moment where the DJ changes songs",
    "The vocal part of the track"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'outro' of a track and why does it matter to the DJ?",
   "opts": [
    "The most energetic part — the climax of the set",
    "The closing section, a mirror of the intro, clean or stripped down — ideal for mixing out without conflict",
    "The last 4 beats before the breakdown",
    "The point where the track repeats in a loop",
    "The lead vocal section"
   ],
   "ans": 1
  },
  {
   "q": "At what point in the track is it most professional to do the mix-in?",
   "opts": [
    "In the middle of the outgoing track's breakdown",
    "On the incoming track's clean intro over a rhythmic section of the outgoing track — generally at the start of a phrase",
    "At any point as long as the beatmatching is correct",
    "Only during the outgoing track's drop",
    "Only at the start of the outgoing track"
   ],
   "ans": 1
  },
  {
   "q": "What is a 'hot cue' in the context of track structure?",
   "opts": [
    "A type of hot-swap connector for the mixer",
    "A pre-programmed marker that lets you jump instantly to key points in the track (Intro, Drop, Breakdown, Outro)",
    "A feature exclusive to the Pioneer CDJ-3000",
    "The track's maximum BPM",
    "A fast beatmatching technique"
   ],
   "ans": 1
  },
  {
   "q": "Why do you place a hot cue on a track's 'clean intro'?",
   "opts": [
    "To decorate the digital library",
    "To jump straight to the right mix point without searching manually during the live set",
    "Only for tracks with a vocal intro",
    "To mark the track as a favorite",
    "To sync the beatgrid automatically"
   ],
   "ans": 1
  },
  {
   "q": "What does a flat, low-amplitude waveform indicate in the track?",
   "opts": [
    "That the track is low in volume and needs to be turned up",
    "A low-energy section: breakdown, clean intro or a section with no kick — ideal for mixing without a clash",
    "That the track is damaged and can't be used",
    "That the track's BPM is variable",
    "That there's an error in the metadata"
   ],
   "ans": 1
  },
  {
   "q": "What does a dense, tall waveform from end to end indicate?",
   "opts": [
    "That the track sounds better on large monitors",
    "A high-energy section with kick, bass, melody and effects all active — a peak zone that calls for care when mixing",
    "That the track is well mastered",
    "That the BPM is exactly 128",
    "That the track is a recent release"
   ],
   "ans": 1
  },
  {
   "q": "How many beats are in a bar in 4/4 time?",
   "opts": [
    "2 beats",
    "3 beats",
    "4 beats",
    "8 beats",
    "16 beats"
   ],
   "ans": 2
  },
  {
   "q": "Why do club tracks have longer intros than radio tracks?",
   "opts": [
    "Because of a producer mistake",
    "To give the DJ time to beatmatch, adjust the EQ and make the transition without pressure — radio has cuts because there's no DJ mixing",
    "Because club producers are slower",
    "Because in clubs the equipment needs more loading time",
    "Only in Techno, not in every genre"
   ],
   "ans": 1
  },
  {
   "q": "What is a track's 'beatgrid' in DJ software?",
   "opts": [
    "The size of the waveform on screen",
    "The grid that maps exactly where each beat falls — the basis for automatic beatmatching, loops and precise hot cues",
    "The name of the playlist in Serato",
    "The track's average BPM",
    "The frequency spectrum analyzer"
   ],
   "ans": 1
  },
  {
   "q": "What happens if a track's beatgrid is miscalibrated?",
   "opts": [
    "It only affects the display, not the audio",
    "Loops come out misaligned, hot cues don't land on the beat and automatic sync causes drift — the track becomes a problem in the booth",
    "The CDJ shows a read error",
    "The track won't export to USB",
    "It only matters if the DJ uses automatic sync"
   ],
   "ans": 1
  },
  {
   "q": "What is the most common structure of a House / Tech House track?",
   "opts": [
    "Intro, guitar solo, pop chorus, fade",
    "Intro (32 bars), main/vocal section, breakdown, build, drop, breakdown 2, drop 2, outro",
    "Just the drop repeated 3 times with a fade",
    "Intro, riff, bridge, chorus, ending",
    "There's no fixed structure — it's completely random"
   ],
   "ans": 1
  },
  {
   "q": "What strategic function does the breakdown serve in the context of a DJ set?",
   "opts": [
    "It's a production error that should be avoided",
    "Creating emotional tension — the 'breather' that makes the crowd demand the next peak with more intensity",
    "So the DJ can grab a drink of water",
    "To momentarily lower the system volume",
    "Only relevant in pop genres"
   ],
   "ans": 1
  },
  {
   "q": "When should the DJ avoid mixing in during a track's drop?",
   "opts": [
    "Never — the drop is the best time to mix",
    "If the incoming track also has its drop active — two simultaneous drops overload the system and create sonic chaos",
    "The drop is always the ideal time to mix",
    "If the equipment is less than 5 years old",
    "Only in slower genres"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'energy graph' of a track in Rekordbox?",
   "opts": [
    "The electrical energy cost of the system",
    "The visual representation of the track's dynamic intensity over time — it helps the DJ identify peaks, valleys and mix points without having to listen",
    "The audio quality of the file",
    "The track's play history",
    "The position of the main hot cue"
   ],
   "ans": 1
  },
  {
   "q": "A professional DJ checks the track's waveform before every set. Why?",
   "opts": [
    "Just for visual aesthetics on the screen",
    "To identify structure, mix points and energy sections and pre-program hot cues — reducing improvised reactions during the live set",
    "Because the software requires it before playing",
    "To verify that the BPM is detectable",
    "Only necessary for beginner DJs"
   ],
   "ans": 1
  }
 ],
 "Q4": [
  {
   "q": "What is beatmatching?",
   "opts": [
    "Syncing the lighting system to the music",
    "Adjusting the BPM and phase of two tracks so their beats line up exactly",
    "Copying another DJ's musical style",
    "Using the software's auto sync at all times",
    "Lining up music genres by compatibility"
   ],
   "ans": 1
  },
  {
   "q": "You're mixing and the incoming track is running faster than the one playing. What do you adjust?",
   "opts": [
    "Raise the incoming channel's volume",
    "Turn on auto sync right away",
    "Lower the incoming track's pitch to slow it down",
    "Raise the pitch of the track that's already playing",
    "Switch tracks without mixing"
   ],
   "ans": 2
  },
  {
   "q": "What happens when you mix two tracks more than 3 BPM apart without adjusting?",
   "opts": [
    "The mix sounds perfect if the DJ is skilled enough",
    "The beats gradually drift out of sync and the error becomes clearly audible",
    "The software corrects it automatically",
    "It's only a problem in fast genres like Techno",
    "Nothing, as long as you have good monitors"
   ],
   "ans": 1
  },
  {
   "q": "When is it appropriate to use a 'cut' (abrupt transition)?",
   "opts": [
    "Always — it's the most professional transition",
    "For dramatic energy changes, genre switches, or strategic stops",
    "Only in slow genres like R&B",
    "When EQ mixing isn't working",
    "Never — the cut is a beginner's mistake"
   ],
   "ans": 1
  },
  {
   "q": "What is a 'long blend' and when is it used?",
   "opts": [
    "A mistake where two tracks play together for more than 30 seconds",
    "A slow mix where both tracks coexist for 16–32 bars — ideal for Techno, Deep House and other slow-evolving genres",
    "A technique used exclusively by battle DJs in competition",
    "Mixing with only the crossfader without touching the EQ",
    "A Rekordbox shortcut for creating automatic playlists"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'echo out' as a transition technique?",
   "opts": [
    "Using the room's reverb to hide beatmatching mistakes",
    "Applying an echo/decay effect to the outgoing track as it fades out, creating a smooth, fluid exit",
    "Making a cut on the rhythm of the room's echo",
    "Repeating the same drop twice in a row",
    "A bass filter that gradually closes"
   ],
   "ans": 1
  },
  {
   "q": "What is a 'filter sweep' used as a transition?",
   "opts": [
    "Sweeping the crossfader abruptly from one side to the other",
    "Gradually closing the high-pass filter on the outgoing track while the incoming one gradually opens — a transition with no harsh cuts",
    "Applying reverb to the monitor channel",
    "Using the loop to extend the track while the other one loads",
    "A technique only available on the Pioneer CDJ-3000"
   ],
   "ans": 1
  },
  {
   "q": "What is the proper purpose of the loop as a mixing tool?",
   "opts": [
    "Replacing beatmatching skills",
    "Extending a section of the outgoing track to buy time and find the exact entry point for the next one",
    "Repeating the drop until the crowd reacts positively",
    "Automatically correcting BPM errors",
    "Only for use in battle DJ sets"
   ],
   "ans": 1
  },
  {
   "q": "When is an acapella used as a bridge between genres?",
   "opts": [
    "Only when both tracks have exactly the same BPM",
    "To cross between incompatible BPM ranges or genres — a vocal with no instruments works over almost any rhythm",
    "Only in vocal-driven genres like R&B and Soul",
    "To fill time while the next track loads",
    "Only with the DJ's own produced tracks"
   ],
   "ans": 1
  },
  {
   "q": "What is a 'musical phrase' in the context of DJing?",
   "opts": [
    "The DJ's stage name",
    "A structured section of music lasting 8, 16 or 32 bars with a natural beginning and end",
    "The total length of a club set",
    "The time between the drop and the breakdown of a track",
    "The space between two consecutive beats"
   ],
   "ans": 1
  },
  {
   "q": "How many beats are in a 16-bar phrase in 4/4 time?",
   "opts": [
    "16 beats",
    "32 beats",
    "64 beats",
    "8 beats",
    "128 beats"
   ],
   "ans": 2
  },
  {
   "q": "Where should a professional transition happen?",
   "opts": [
    "Anywhere — if the DJ decides it, it's valid",
    "At the start of a new musical phrase — typically on beat 1 of a bar",
    "Only on drops",
    "At the track's moment of peak energy",
    "During the breakdown for the element of surprise"
   ],
   "ans": 1
  },
  {
   "q": "What is the consequence of mixing 'off-phrase'?",
   "opts": [
    "The mix is perfect as long as the beatmatching is correct",
    "The musical elements of both tracks clash — verses over choruses, intros over drops — creating auditory confusion",
    "The software sounds an audible warning",
    "The audience won't notice if the volume is loud",
    "It only matters in highly structured genres like House"
   ],
   "ans": 1
  },
  {
   "q": "Why do you cut the bass on the incoming track BEFORE or DURING the transition?",
   "opts": [
    "To make the mix faster",
    "To keep two different basslines from clashing in frequency, creating mud and distortion in the system",
    "Because club DJs always do it that way",
    "To save power on the amplifier",
    "It's only done in 4x4 genres like Techno"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'golden rule' of the EQ swap in a professional transition?",
   "opts": [
    "Never touch the EQ during a live mix",
    "When the outgoing track has its bass at 100%, the incoming one should have it at 0% — the swap is done gradually during the transition",
    "Raise the mid EQ on both tracks at the same time",
    "Use only the crossfader, never the EQ",
    "EQ is only adjusted on the booth monitor, not on the master"
   ],
   "ans": 1
  },
  {
   "q": "What happens when two tracks play at once with their bass at 100% through the system?",
   "opts": [
    "The sound becomes more powerful and energetic",
    "The low frequencies of both add up, causing bass overload, amplifier saturation and loss of clarity",
    "The audio system compensates automatically",
    "It only affects small systems",
    "Nothing noticeable if both tracks have the same BPM"
   ],
   "ans": 1
  },
  {
   "q": "A DJ does an 'EQ swap' during the transition. What exactly are they doing?",
   "opts": [
    "Replacing the physical equalizer with a higher-quality one",
    "Simultaneously closing the lows on the outgoing track while opening them on the incoming one — handing the lead bass role from one track to the other",
    "Matching the volume of both channels before mixing",
    "Applying the same EQ preset to both channels",
    "Adjusting room correction with the system's graphic equalizer"
   ],
   "ans": 1
  },
  {
   "q": "What is harmonic mixing?",
   "opts": [
    "Mixing tracks by the same artist",
    "Selecting tracks whose keys are compatible with each other to avoid harmonic clashes in transitions",
    "Mixing similar genres like House with Deep House",
    "Using the crossfader smoothly without abrupt cuts",
    "Adjusting the tempo in 0.1 BPM increments"
   ],
   "ans": 1
  },
  {
   "q": "What tool is used as a reference for harmonic mixing?",
   "opts": [
    "The CDJ's BPM counter",
    "The Camelot wheel — a 24-position system that shows which keys are compatible with each other",
    "The mixer's pitch fader",
    "The hot cues set in Rekordbox",
    "The real-time spectrum analyzer's frequency display"
   ],
   "ans": 1
  },
  {
   "q": "What does moving '1 step' on the Camelot wheel mean?",
   "opts": [
    "Changing the BPM by exactly 1",
    "Moving to the adjacent key on the wheel — the safest, most harmonically compatible move",
    "Raising or lowering the key by 1 semitone with pitch correction",
    "Switching from major to minor in the same key",
    "Automatically selecting the next track in the playlist"
   ],
   "ans": 1
  },
  {
   "q": "In which genres or situations is it CRITICAL to use the Camelot wheel?",
   "opts": [
    "In all genres without exception — it's always mandatory",
    "In melodic genres with a strong harmonic presence: Deep House, Progressive House, Trance, Melodic Techno — where the melodies of both tracks would sound at the same time",
    "Only at festivals with more than 10,000 people",
    "Only when the DJ uses vinyl, not CDJs",
    "Mainly in Hip-Hop and Reggaeton"
   ],
   "ans": 1
  },
  {
   "q": "In which situation does harmonic compatibility matter LEAST?",
   "opts": [
    "In professional electronic genres it always matters equally",
    "When the transition happens in a purely percussive section (no active melody) or when a clean cut is used with no overlapping melodies",
    "Never — harmony is always the most important factor",
    "When the DJ uses headphones instead of booth monitors",
    "Only when the sound system is low quality"
   ],
   "ans": 1
  },
  {
   "q": "An open format DJ is mixing from Hip-Hop (95 BPM) into House (124 BPM). Does it make sense to use the Camelot wheel for this transition?",
   "opts": [
    "Yes — you should always check the Camelot wheel before every transition",
    "Not directly — the BPM gap is so large that the transition should be done by cut or acapella, with no overlapping melodies, so harmony between keys doesn't apply",
    "Only if both tracks are in the same key",
    "Only at international festivals",
    "Yes, but only if the DJ has more than 5 years of experience"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'energy curve' of a night at a professional club?",
   "opts": [
    "The graph of the sound system's power consumption",
    "The strategic arc of the set: gradual opening → build → peak → wind-down — designed to maximize the crowd's experience throughout the night",
    "The average Master volume level over the night",
    "The frequency curve shown on the spectrum analyzer",
    "The history of tracks played, ordered by popularity"
   ],
   "ans": 1
  },
  {
   "q": "What programming mistake kills the dance floor too early?",
   "opts": [
    "Mixing different genres in the same set",
    "Opening the set with the heaviest / highest-energy tracks — burning through the energy before the room fills up, with nowhere left to go",
    "Using long transitions of more than 16 bars",
    "Repeating a popular track at the end of the set",
    "Mixing at a higher BPM than the previous headliner"
   ],
   "ans": 1
  },
  {
   "q": "What is an intentional 'energy dip' and what is its strategic purpose?",
   "opts": [
    "A technical volume glitch during the set",
    "Deliberately lowering the energy to build tension, make the crowd demand more and make the next peak hit harder",
    "Lowering the volume to protect the audience's ears",
    "A type of abrupt cut between tracks of different genres",
    "A technical system warning about clipping"
   ],
   "ans": 1
  },
  {
   "q": "What is the key programming difference between a festival set and a club set?",
   "opts": [
    "There is no difference — the programming is always the same",
    "Festival: immediate impact, recognizable tracks, massive drops, few long transitions. Club: progressive storytelling, detailed technique, slow build, the crowd follows a complete journey",
    "Club always runs at a higher BPM than festival",
    "Festival always starts with bass and ends with melody. Club is the opposite",
    "Only the volume and the number of subwoofers change"
   ],
   "ans": 1
  },
  {
   "q": "What does 'reading the crowd' mean for a professional DJ?",
   "opts": [
    "Viewing the song lyrics on the CDJ",
    "Watching the crowd's reaction in real time and adjusting the music selection, BPM and energy of the set accordingly — constant adaptation",
    "Checking the playlist prepared before the event and following it without changes",
    "Watching the Master level meter all night",
    "Counting the beats manually without using the software"
   ],
   "ans": 1
  },
  {
   "q": "When is it appropriate to break the planned structure of a set?",
   "opts": [
    "Never — the plan is sacred and doesn't change",
    "When reading the crowd shows they need something different: higher or lower energy, a different genre, or an unexpected track that connects better with the moment",
    "Only if the promoter explicitly asks from the side of the stage",
    "Only if the next scheduled track has a metadata error",
    "When the DJ has been playing for more than 2 hours and needs a change"
   ],
   "ans": 1
  }
 ],
 "Q6": [
  {
   "q": "What is the typical BPM range of classic and commercial House music?",
   "opts": [
    "70–90 BPM",
    "100–115 BPM",
    "120–130 BPM",
    "135–145 BPM",
    "150–165 BPM"
   ],
   "ans": 2
  },
  {
   "q": "What is the BPM range of industrial and club Techno?",
   "opts": [
    "100–115 BPM",
    "120–128 BPM",
    "130–150 BPM",
    "160–180 BPM",
    "80–100 BPM"
   ],
   "ans": 2
  },
  {
   "q": "What is the typical BPM of classic Hip-Hop?",
   "opts": [
    "120–130 BPM",
    "85–100 BPM",
    "140–160 BPM",
    "70–80 BPM",
    "110–120 BPM"
   ],
   "ans": 1
  },
  {
   "q": "What is the BPM range of Reggaeton / Dembow?",
   "opts": [
    "100–108 BPM",
    "120–128 BPM",
    "85–95 BPM",
    "140–150 BPM",
    "70–80 BPM"
   ],
   "ans": 0
  },
  {
   "q": "What is the BPM range of Drum & Bass?",
   "opts": [
    "120–130 BPM",
    "85–100 BPM",
    "160–180 BPM",
    "130–145 BPM",
    "100–115 BPM"
   ],
   "ans": 2
  },
  {
   "q": "What sonically sets Deep House apart from classic House?",
   "opts": [
    "It is faster and more aggressive, with massive drops",
    "It is slower and darker, with thick basslines, melancholic atmospheres and fewer percussive elements",
    "It is identical to House but with female vocals",
    "It has scratching and breakbeats",
    "The only difference is a higher BPM"
   ],
   "ans": 1
  },
  {
   "q": "What sets Tech House apart from Deep House?",
   "opts": [
    "Tech House is only produced in Berlin",
    "Tech House fuses the dark grooves of Techno with the danceable structure of House — more percussive, more functional, similar BPM",
    "Tech House has a lower BPM than Deep House",
    "Deep House always has vocals and Tech House never does",
    "There is no real difference — they are the same genre"
   ],
   "ans": 1
  },
  {
   "q": "In what setting or venue is Afrobeats mainly played?",
   "opts": [
    "Underground Techno clubs",
    "Mainstream open events, venues with a multicultural audience, Latin and African events, summer parties",
    "Adapted classical music festivals",
    "Only illegal raves",
    "Only at sporting events"
   ],
   "ans": 1
  },
  {
   "q": "What is the main structural characteristic of melodic Trance?",
   "opts": [
    "Abrupt drops with no build-up",
    "Very long, high-tension builds (up to 32 bars), euphoric drops with emotive melodies, a complete emotional journey",
    "No defined structure — completely improvised",
    "Percussion only, no melody",
    "Based on hip-hop samples"
   ],
   "ans": 1
  },
  {
   "q": "What is 'Open Format' as a programming concept?",
   "opts": [
    "A DJ software configuration error",
    "The ability to mix multiple genres in a single night while keeping the energy coherent — Hip-Hop, House, Reggaeton, Afro, R&B in the same set",
    "Mixing only electronic genres",
    "Using only royalty-free music",
    "A technique exclusive to DJs with more than 10 years of experience"
   ],
   "ans": 1
  },
  {
   "q": "What is the approximate BPM of Merengue?",
   "opts": [
    "120–130 BPM",
    "60–70 BPM",
    "145–200+ BPM",
    "100–110 BPM",
    "80–90 BPM"
   ],
   "ans": 2
  },
  {
   "q": "What distinguishes Salsa from Merengue rhythmically, from a DJ's perspective?",
   "opts": [
    "They are identical — only the name changes",
    "Salsa has a complex African clave (2-3 or 3-2) and a more moderate BPM; Merengue has a more mechanical 'palo' or 'güira' and a faster BPM",
    "Merengue is always slower",
    "Salsa has no percussion, Merengue does",
    "They differ only in the language of the lyrics"
   ],
   "ans": 1
  },
  {
   "q": "How do you tell Minimal Techno apart from industrial Techno?",
   "opts": [
    "Minimal Techno is faster",
    "Minimal uses fewer sonic elements — hypnotic repetition, subtle basslines, almost no melody — atmospheric and dark",
    "Minimal always has vocals",
    "Industrial Techno has a lower BPM",
    "There is no technical difference"
   ],
   "ans": 1
  },
  {
   "q": "What is the main characteristic of commercial EDM (Electronic Dance Music)?",
   "opts": [
    "High harmonic and technical complexity",
    "Massive, high-impact drops, recognizable melodies, simple structure, designed for maximum impact at massive festivals",
    "Very slow BPM to create atmosphere",
    "Percussion only, no melody",
    "Produced exclusively for streaming, not for clubs"
   ],
   "ans": 1
  },
  {
   "q": "An Open Format DJ is playing a mixed event. When does it make sense to go from Reggaeton to House?",
   "opts": [
    "Never — they are incompatible genres",
    "During a transition in a percussive section, using an instrumental or acapella track as a bridge, when the Reggaeton energy has peaked and the crowd is ready",
    "Only if both tracks are in the same key",
    "Only if the promoter asks for it",
    "When the DJ is bored with the genre"
   ],
   "ans": 1
  },
  {
   "q": "What is the approximate BPM of modern Bachata?",
   "opts": [
    "60–70 BPM",
    "100–115 BPM",
    "120–128 BPM",
    "130–145 BPM",
    "145–160 BPM"
   ],
   "ans": 1
  },
  {
   "q": "How does a DJ recognize an Afro House or Afro Tech track?",
   "opts": [
    "By an 80 BPM tempo and English lyrics",
    "By layered African percussive rhythms (shakers, congas, digital djembes), a 120–128 BPM tempo, tribal atmospheres and hypnotic melodies",
    "By the massive EDM drops",
    "By a structure identical to classic House",
    "By the mandatory use of female vocals"
   ],
   "ans": 1
  },
  {
   "q": "What is the BPM of modern R&B / Neo Soul?",
   "opts": [
    "120–130 BPM",
    "60–80 BPM",
    "140–160 BPM",
    "90–100 BPM",
    "100–115 BPM"
   ],
   "ans": 3
  },
  {
   "q": "What is the worst mistake a DJ can make when it comes to genres?",
   "opts": [
    "Mixing two different genres in the same set",
    "Mixing up genres in public or mixing without knowing the technical differences — playing Salsa where House should go, or vice versa, with no judgment",
    "Using the Camelot wheel for all genres",
    "Preparing a playlist with different genres",
    "Mixing Techno with House in the same set"
   ],
   "ans": 1
  },
  {
   "q": "In what setting is hard Techno (130-145 BPM) most appropriate?",
   "opts": [
    "Weddings and family events",
    "Specialized underground clubs, raves, dark electronic music festivals — an audience that specifically came for it",
    "Luxury corporate events",
    "Quinceañera parties",
    "Any event — Techno works everywhere"
   ],
   "ans": 1
  },
  {
   "q": "Why is it wrong to play the same EDM festival tracks in an intimate club of 200 people?",
   "opts": [
    "There is no difference — tracks sound the same in any context",
    "EDM festival tracks are designed for crowds of 10,000+ with immediate impact — in a small club they lose depth, and the crowd misses the journey and progressive narrative",
    "Festival tracks cost more on digital platforms",
    "It only works if the sound system is good",
    "The BPM of EDM is incompatible with clubs"
   ],
   "ans": 1
  },
  {
   "q": "What is 'groove' and why does it matter when selecting genres?",
   "opts": [
    "The bass volume of the sound system",
    "The rhythmic feel that makes the body move — the result of the combination of kick, bass, hi-hats and swing — each genre has its own characteristic groove that determines whether it works on the dance floor",
    "The genre's popularity level on Spotify",
    "The speed of the BPM",
    "The mastering quality of the track"
   ],
   "ans": 1
  }
 ],
 "Q7": [
  {
   "q": "What is a DJ's 'technical rider' and why does it matter?",
   "opts": [
    "A list of the DJ's favorite songs",
    "A document that specifies the DJ's technical requirements (gear, connections, monitor, hospitality rider) that the venue must provide before the event",
    "The DJ's payment contract",
    "A description of the DJ's musical style for the promoter",
    "An operating manual for the booth equipment"
   ],
   "ans": 1
  },
  {
   "q": "What should a professional DJ's technical rider include at a minimum?",
   "opts": [
    "Only the DJ's name and fee",
    "Required gear (CDJs, mixer, monitor), connection specs (XLR, line or digital), booth space needs, and a technical contact",
    "Only the name of the gear the DJ uses",
    "The planned setlist for the event",
    "Only the number of hours of the performance"
   ],
   "ans": 1
  },
  {
   "q": "When should the technical rider be sent to the promoter or venue?",
   "opts": [
    "On the day of the event",
    "With enough lead time — at least 2 weeks ahead — so the venue has time to prepare or source the required gear",
    "Only if the promoter explicitly asks for it",
    "Only for large festivals, not for clubs",
    "The night before the event"
   ],
   "ans": 1
  },
  {
   "q": "What is the correct etiquette when arriving at the booth while another DJ is playing?",
   "opts": [
    "Start checking the equipment right away to get familiar with it",
    "Greet the DJ discreetly, wait outside the booth until they finish or invite you in, and never interrupt the flow of the set",
    "Demand that the current DJ wrap up as soon as possible",
    "Browse the library on the CDJ of the DJ who is playing",
    "Plug your USB into the free CDJ immediately"
   ],
   "ans": 1
  },
  {
   "q": "What is the basic etiquette rule about USB drives in a shared booth?",
   "opts": [
    "Any DJ can use another DJ's USB if they need it",
    "Never unplug another DJ's USB while they are playing — always wait until their track ends, they let you know, and they properly hand over the turn",
    "You can use the second free CDJ without telling anyone",
    "USBs always stay in the equipment for everyone to use",
    "There are no rules about USBs in a professional booth"
   ],
   "ans": 1
  },
  {
   "q": "How should a professional DJ handle a song request from the crowd or the promoter during the set?",
   "opts": [
    "Always play what the crowd asks for immediately",
    "Assess whether it fits the energy and the moment of the set — if it doesn't, politely commit to it but never promise it will be played right then",
    "Ignore all requests completely",
    "Always refuse to play requests — it's a sign of weakness",
    "Ask them to write the request on paper before considering it"
   ],
   "ans": 1
  },
  {
   "q": "What does 'no dead air' mean in the booth and why is it a fundamental rule?",
   "opts": [
    "It means the DJ must talk on the microphone constantly",
    "Unexpected silence at an event is one of the worst mistakes — it kills the energy, confuses the crowd and instantly damages the reputation of the DJ and the venue",
    "It only applies at large festivals, not small clubs",
    "It's only a suggestion — some silences are creative",
    "Silence is not a mistake if it lasts less than 5 seconds"
   ],
   "ans": 1
  },
  {
   "q": "What professional attitude should a DJ have when the promoter asks for a change of musical direction during the set?",
   "opts": [
    "Always refuse — the DJ has total artistic control",
    "Listen, assess whether the change makes sense for the event, and if it's valid, adapt with good judgment — communication and flexibility are key in professional work",
    "Only accept if the change is paid extra",
    "Ignore the promoter — the DJ is the expert",
    "End the set immediately if they disagree"
   ],
   "ans": 1
  },
  {
   "q": "Why shouldn't a professional DJ drink excessively during their set?",
   "opts": [
    "Because alcohol boosts creativity but reduces technical control equally",
    "Because an impaired state compromises beatmatching, transition timing and decision-making — and also damages the professional image with promoters and the crowd",
    "It's a rule only for beginner DJs; professionals can handle any amount",
    "There's no problem — the DJ should enjoy the event",
    "It only matters if the DJ plays vinyl — it doesn't affect digital"
   ],
   "ans": 1
  },
  {
   "q": "What is the minimum information that should be confirmed with the promoter before the event?",
   "opts": [
    "Only the arrival time",
    "Arrival and setup time, set start and end times, required genre, expected type of crowd, available equipment, and a technical contact person at the venue",
    "Only the available equipment",
    "Only the payment and the set time",
    "Only the required music genre"
   ],
   "ans": 1
  },
  {
   "q": "What is the protocol difference between playing a club and playing a wedding or private event?",
   "opts": [
    "There is no difference — the DJ plays the same way in every context",
    "In a club the DJ has more artistic freedom; at private events the DJ must adapt the music to the client, the venue's restrictions and a family audience — more advance communication is essential",
    "At weddings the DJ can play faster",
    "In clubs the DJ has no creativity — only private events allow freedom",
    "Private events are handled exactly the same as clubs"
   ],
   "ans": 1
  },
  {
   "q": "What is the correct behavior when finishing your set and leaving the booth?",
   "opts": [
    "Leave immediately without telling anyone",
    "Start the handover to the next DJ well in advance, make sure the audio keeps running smoothly, remove your USB only once the next DJ has control, and thank the team",
    "Leave the equipment as you found it when you arrived, regardless of anything else",
    "Unplug all the equipment when you finish",
    "Turn off the CDJs to signal that you're done"
   ],
   "ans": 1
  },
  {
   "q": "What should you do if you arrive at the venue and the equipment doesn't match your technical rider?",
   "opts": [
    "Cancel immediately and leave",
    "Calmly contact the venue's technician, identify what you can adapt to, tell the promoter about the changes and look for solutions — professionalism shows in how you handle the unexpected",
    "Demand they get the right equipment before your set, no matter how long it takes",
    "Play regardless of the equipment — never complain",
    "It only applies if the event is very important"
   ],
   "ans": 1
  },
  {
   "q": "Why is punctuality important when arriving at the venue for setup?",
   "opts": [
    "It isn't important — DJs arrive when they can",
    "Arriving on time for setup ensures you can check the equipment, do a soundcheck, set up hot cues and get mentally prepared — arriving late causes technical errors and an impression of unprofessionalism",
    "Only being on time for the set matters, not for setup",
    "Punctuality is just social protocol, not technical",
    "Checking the equipment doesn't take time — it's instant"
   ],
   "ans": 1
  },
  {
   "q": "What is the correct attitude toward a visible technical failure during the set?",
   "opts": [
    "Visible panic and pointing at the production team in front of the crowd",
    "Stay calm, activate the emergency protocol you know, and fix it without showing signs of panic — the crowd picks up on the DJ's attitude, and calm conveys confidence",
    "Leave the set immediately and look for technical help",
    "Apologize to the crowd over the microphone",
    "It only applies if the failure lasts more than 30 seconds"
   ],
   "ans": 1
  },
  {
   "q": "What does 'soundcheck' mean in the booth and why is it mandatory?",
   "opts": [
    "A check of the club's speakers — not the DJ's responsibility",
    "A full check of the audio chain: CDJ → mixer → system — verifying levels, no feedback, working monitors and correct connections before the crowd comes in",
    "Only necessary at festivals with a production crew",
    "It's optional — the DJ decides whether to do it or not",
    "It's a check that the lighting works"
   ],
   "ans": 1
  },
  {
   "q": "Why should the DJ have the venue sound technician's WhatsApp number before the event?",
   "opts": [
    "For social protocol — it's a courtesy",
    "For direct communication in case of technical failures during the set — the technician can fix sound problems from the main console without the DJ having to stop the set",
    "Only for very large events",
    "To coordinate the setlist with the technician",
    "There's no reason — the technician can't do anything during the set"
   ],
   "ans": 1
  },
  {
   "q": "What is the correct policy on photos and videos in the booth during the set?",
   "opts": [
    "The DJ can do whatever they want, including full live posts",
    "Check that the venue doesn't restrict phone use in the booth, and keep phone interaction to a minimum during the active set — divided attention between the phone and the decks is unprofessional",
    "Never take photos — it's always forbidden",
    "Photos are only allowed during the breakdown",
    "The promoter is responsible for photos — not the DJ"
   ],
   "ans": 1
  }
 ],
 "Q8": [
  {
   "q": "What is the first thing you do when the audio cuts out unexpectedly during your set?",
   "opts": [
    "Panic — immediately announce it to the crowd over the mic",
    "Run a 3-second check: channel fader up? Crossfader in the right position? USB connected? Master level up? — fix it before the silence passes 5 seconds",
    "Unplug all the gear and restart",
    "Blame the venue's sound tech in front of the crowd",
    "Leave the booth right away to look for help"
   ],
   "ans": 1
  },
  {
   "q": "What is an 'audio plan B' and why should every professional DJ have one?",
   "opts": [
    "A second set prepared with different tracks",
    "A backup solution ready to go the moment the main setup fails — it can be a smartphone with an adapter, a laptop with Serato/Rekordbox, or a second USB with the same set",
    "A partner who plays while the DJ deals with the emergency",
    "It's only necessary for big festivals",
    "A plan B is only for DJs with more than 5 years of experience"
   ],
   "ans": 1
  },
  {
   "q": "A CDJ freezes during your set. What is the correct protocol?",
   "opts": [
    "Power it off immediately — that fixes any problem",
    "Move all the audio to the working CDJ, extend the playing track with a loop, and try to restart the frozen CDJ while the audio keeps playing without interruption",
    "Stop the set and ask for technical help",
    "Unplug the USB from both CDJs at the same time",
    "Tell the crowd there's a technical problem"
   ],
   "ans": 1
  },
  {
   "q": "Why should you always carry two copies of your set on different USB drives?",
   "opts": [
    "In case a USB drive runs out of battery — USB drives don't have batteries",
    "If a USB drive fails due to corruption, read errors, or physical damage, the second one lets you keep the set going immediately with no interruption — redundancy is standard protocol in a professional booth",
    "So you can hand the second USB drive to the next DJ",
    "Only necessary on Pioneer CDJs — not on other gear",
    "USB drives rarely fail — it's an unnecessary precaution"
   ],
   "ans": 1
  },
  {
   "q": "What should you do if the mixer loses signal on a channel during your set?",
   "opts": [
    "Turn the mixer off immediately",
    "Quickly move the track to a working channel using the crossfader or the mixer's alternate channel, keep the audio continuous, and tell the venue's tech about the problem while the set continues",
    "Pull the master down so the fault can't be heard",
    "Carry on as if nothing happened — the crowd won't notice mixer problems",
    "Unplug and replug all the mixer's cables"
   ],
   "ans": 1
  },
  {
   "q": "What is the correct use of a loop during a technical emergency?",
   "opts": [
    "Looping isn't available during an emergency",
    "Immediately engage an 8- or 16-bar loop on the playing track to buy time while you fix the technical problem, without breaking the rhythm",
    "Loops only work on certain CDJ models",
    "A loop is only a creative effect, not an emergency tool",
    "Engaging a loop tells the crowd there's a problem"
   ],
   "ans": 1
  },
  {
   "q": "The venue has a brief power outage during your set. What is the protocol?",
   "opts": [
    "Leave the venue — it's the venue's responsibility to restart everything",
    "Stay calm, check that the UPS or equipment protection worked, restart the CDJs that shut down, and pick up from the most recent track — a brief outage is manageable with the right protocol",
    "Restart all the gear at the same time for speed",
    "Ask the tech to turn the volume up to maximum when power returns",
    "There's no protocol — every situation is different"
   ],
   "ans": 1
  },
  {
   "q": "Why should a professional DJ know how to use Rekordbox or Serato on a laptop in addition to CDJs?",
   "opts": [
    "Because a laptop has better audio quality than CDJs",
    "As an emergency backup: if the venue's CDJs fail or won't read your USB, a laptop with an audio interface lets you keep the set going without depending on the venue's gear",
    "To impress the crowd with the laptop screen",
    "Laptops aren't used in professional sets",
    "Only necessary if the DJ produces music"
   ],
   "ans": 1
  },
  {
   "q": "What do you check if there's feedback (a high-pitched squeal) during your set?",
   "opts": [
    "Push the channel fader up to overpower it",
    "Identify the source — usually a monitor too close to a microphone or a gain set wrong — and immediately turn down the gain or volume of whatever is causing the feedback",
    "Feedback isn't the DJ's problem — it's the sound tech's problem",
    "Turn off all the venue's microphones",
    "Ignore it — it goes away on its own in 30 seconds"
   ],
   "ans": 1
  },
  {
   "q": "What is the '5-second rule' in the booth?",
   "opts": [
    "You have 5 seconds to prepare the next track",
    "No unexpected silence should last longer than 5 seconds — after that, the damage to the dance floor's energy becomes significant and hard to recover",
    "It's just an informal guideline — not a real rule",
    "5 seconds of silence is acceptable in slower genres",
    "The 5-second rule only applies to festivals"
   ],
   "ans": 1
  },
  {
   "q": "A track skips because of a damaged sector on the USB drive. How do you deal with it?",
   "opts": [
    "Let the skip go by — the crowd won't notice",
    "Manually skip ahead to the next clean spot, or jump straight to the next track using a hot cue — never let a damaged track keep skipping on the dance floor",
    "Restart the whole CDJ",
    "Format the USB drive during the set",
    "Ask the tech to check the speakers"
   ],
   "ans": 1
  },
  {
   "q": "Why should you do a full check of all your cables before every event?",
   "opts": [
    "It's part of the venue's cleaning protocol",
    "A faulty or wrong cable can cause audio dropouts, feedback, or an unstable signal during the set — checking beforehand keeps the problem from happening in the middle of your performance",
    "Cables rarely fail — checking isn't necessary",
    "Only necessary if the gear is rented",
    "The venue's tech does the check, not the DJ"
   ],
   "ans": 1
  },
  {
   "q": "What is 'headphone cue' and how does it prevent mistakes live?",
   "opts": [
    "The booth monitor that plays for the crowd",
    "The mixer function that lets you hear the track you're about to play before the audience hears it — essential for checking that the track is loaded correctly, beatmatched, and at the right point before making the transition",
    "An echo effect applied to the track",
    "The mixer's effects return channel",
    "It only works with high-impedance headphones"
   ],
   "ans": 1
  },
  {
   "q": "What is the role of the mixer's 'kill switch' or mute button in an emergency?",
   "opts": [
    "To permanently turn off a channel",
    "To quickly silence a specific channel to isolate the problem without interrupting the rest of the audio — an immediate control tool during feedback, distortion, or an erratic signal",
    "It only has a creative function — no emergency use",
    "The kill switch shuts down the entire sound system",
    "Only available on DJM-900NXS2 mixers or higher"
   ],
   "ans": 1
  },
  {
   "q": "Why is it important to have the venue sound tech's number saved before the event starts?",
   "opts": [
    "Out of professional courtesy",
    "So you can reach them immediately during technical emergencies that require intervention from the main console — the DJ can't fix problems with the venue's overall system without the tech's help",
    "Only necessary if the DJ has limited experience",
    "The venue's tech is always in the booth — you don't need the number",
    "It's not necessary — the tech is always visible at events"
   ],
   "ans": 1
  }
 ],
 "Q9": [
  {
   "q": "Why are a DJ's ears their most important work tool, and why must they be protected?",
   "opts": [
    "They're important but replaceable with visual analysis software",
    "A DJ depends 100% on their hearing for beatmatching, reading the mix, EQing, and communicating — hearing loss is irreversible and permanent, ruining both a career and quality of life",
    "The ear naturally adapts to high volumes over time",
    "Booth monitors compensate for any hearing loss",
    "Hearing loss only affects high frequencies — it doesn't impact a DJ's work"
   ],
   "ans": 1
  },
  {
   "q": "What SPL (sound pressure level) is considered safe for continuous 8-hour exposure under OSHA/NIOSH standards?",
   "opts": [
    "100 dBA — standard club level",
    "85 dBA — above this level, continuous exposure starts to damage the hair cells of the inner ear cumulatively",
    "95 dBA — recommended level for production",
    "75 dBA — minimum level to hear music clearly",
    "110 dBA — standard for professional audio environments"
   ],
   "ans": 1
  },
  {
   "q": "What is the average SPL in a club or festival booth? And what does it imply?",
   "opts": [
    "70-80 dBA — completely safe for any duration",
    "95-115 dBA — at this level, NIOSH standards allow only 1 hour or less of unprotected exposure before cumulative damage begins",
    "85 dBA — the exact permanent safety limit",
    "60 dBA — normal conversation level",
    "80-85 dBA — safe all night without protection"
   ],
   "ans": 1
  },
  {
   "q": "What is tinnitus and why is it the worst consequence for a DJ?",
   "opts": [
    "A creative audio effect — a controlled squeal in the speakers",
    "A persistent ringing or buzzing in the ears caused by damage to the hair cells of the inner ear — it's irreversible, has no cure, and can keep a DJ from hearing mixes and beatmatching properly",
    "A temporary ear infection treated with antibiotics",
    "The natural echo of the ear in large spaces",
    "A symptom that goes away completely with rest"
   ],
   "ans": 1
  },
  {
   "q": "What type of hearing protection should a professional DJ use in the booth during prolonged exposure?",
   "opts": [
    "Generic foam earplugs like the ones for airplanes — they all block the same",
    "High-fidelity (musician's) hearing protection such as Etymotic, Earasers, or custom-molded plugs — they reduce SPL evenly without distorting frequencies, so you can still hear the mix clearly",
    "Regular DJ headphones with passive isolation are enough protection",
    "No protection — professional DJs train their ears to tolerate high volumes",
    "Simple silicone swimming earplugs — they protect just as well as the professional ones"
   ],
   "ans": 1
  },
  {
   "q": "Which high-fidelity musician's earplugs are recognized as the professional reference for hearing protection in the booth?",
   "opts": [
    "Any drugstore earplug",
    "Etymotic ER-20, Earasers, Loop Experience Pro, or custom-molded IEM plugs with flat-attenuation filters — designed to reduce SPL without cutting frequencies",
    "Only AirPods Pro in transparency mode",
    "Bluetooth noise-cancelling headphones",
    "Only the orange 3M industrial earplugs"
   ],
   "ans": 1
  },
  {
   "q": "What rule of thumb helps limit hearing exposure over a night of work?",
   "opts": [
    "Always monitor at maximum volume to keep precise control of the mix",
    "The 60/60 rule: no more than 60 minutes of exposure to high volumes without a 10-minute break, and never more than 60% of the booth monitor's maximum volume if it's adjustable",
    "Turn the monitor up as the night goes on to compensate for listening fatigue",
    "Listen to music in headphones at full volume before the set to 'warm up' your ears",
    "Don't use hearing protection — it interferes with beatmatching"
   ],
   "ans": 1
  },
  {
   "q": "What is 'listening fatigue' and how does it affect a DJ's work during a long set?",
   "opts": [
    "A mixing style that repeats tracks to tire out the crowd",
    "A temporary drop in hearing sensitivity after prolonged exposure to high volumes — the DJ starts turning up monitors and levels unnecessarily, creating a cycle that damages the ears even more",
    "It only affects DJs over 40",
    "It's a positive creative state in which the DJ hears the midrange frequencies better",
    "Listening fatigue doesn't exist in club environments — adrenaline prevents it"
   ],
   "ans": 1
  },
  {
   "q": "Why should a DJ favor the booth monitors over headphones for cueing tracks during the set?",
   "opts": [
    "Monitors always sound better than headphones",
    "Alternating between headphones (cue) and the monitor lets each ear rest in turn, reducing accumulated fatigue compared to wearing headphones full-time for hours",
    "Headphones are always more harmful than monitors at the same volume",
    "The monitor lets the crowd hear what the DJ hears",
    "Only applies if the DJ uses CDJs — with a controller, headphones are mandatory"
   ],
   "ans": 1
  },
  {
   "q": "What is the effect of poor sleep on the hearing health of a DJ who works nights?",
   "opts": [
    "Sleep has no relation to hearing health",
    "Sleep is when the ear's hair cells partially recover — chronic sleep deprivation worsens accumulated hearing damage and raises the risk of permanent tinnitus",
    "Night work improves the ear's tolerance to volume over time",
    "4 hours of sleep is enough for full hearing recovery",
    "Hearing rest is only achieved with total silence for 2 minutes"
   ],
   "ans": 1
  },
  {
   "q": "Why should a DJ get regular hearing exams (audiograms)?",
   "opts": [
    "To meet legal work requirements — it has no other practical use",
    "To catch hearing loss while it's mild and change habits before the damage becomes severe and irreversible — the audiogram shows which frequencies have incipient loss",
    "Only if the DJ has serious symptoms — preventive checkups are unnecessary",
    "Professional DJs don't get hearing loss — training protects them",
    "Hearing loss is always obvious without needing tests"
   ],
   "ans": 1
  },
  {
   "q": "What is the temporary post-exposure 'ringing' (after-ring) and what does it indicate?",
   "opts": [
    "A resonance effect from the venue's sound system — it doesn't come from the ear",
    "A warning sign that the ear was exposed to more volume than it can tolerate — if it happens often, each episode may be causing permanent cumulative damage",
    "It's normal and safe — it happens to all professional DJs with no consequences",
    "It means the venue's sound system needs calibration",
    "It only happens to people with a susceptible genetic makeup — it's not an indicator of damage"
   ],
   "ans": 1
  },
  {
   "q": "What is the best position for the DJ relative to the venue's speakers to reduce exposure?",
   "opts": [
    "As close as possible to the speakers to hear the mix well",
    "Never stand directly in front of the floor or column speakers when possible — the booth is usually off to the side of the main speakers, cutting direct exposure without losing your sonic reference",
    "In the middle of the dance floor facing the system — better read on the mix",
    "On top of the speakers — the perceived volume is lower from above",
    "Position doesn't matter — SPL is uniform throughout the venue"
   ],
   "ans": 1
  },
  {
   "q": "Which hydration and nutrition habits support a DJ's hearing health?",
   "opts": [
    "Alcohol improves circulation in the inner ear — it's beneficial in small amounts",
    "Good hydration (water), avoiding excess alcohol (it reduces blood flow to the inner ear), and a diet rich in Omega-3 and Vitamin B12, which support auditory nerve function — smoking is particularly harmful because it reduces blood supply to the cochlea",
    "Diet has no relation to hearing health",
    "Coffee before the set improves hearing ability",
    "Only exposure volume matters — health habits are irrelevant to the ear"
   ],
   "ans": 1
  },
  {
   "q": "What is the correct protocol after finishing a 4+ hour set in a loud club?",
   "opts": [
    "Head straight to another club or bar with music — the post-work social scene is part of DJ culture",
    "Give your ears at least 12-16 hours of quiet rest or minimal sound exposure, avoid headphones at full volume for the next few hours, and hydrate well — the ear recovers during rest",
    "Listen to music at home at low volume to 'calibrate' your ears",
    "Only necessary if you have active tinnitus after the set",
    "The post-set period isn't important — the damage is either done or it isn't"
   ],
   "ans": 1
  }
 ],
 "Q10": [
  {
   "q": "What are the three main factors that determine a DJ's fee for an event?",
   "opts": [
    "Only the length of the set",
    "Set length, type of event (club/festival/private/wedding), and the DJ's experience level and demand — these three factors combine to set the right market price",
    "Only the type of equipment used",
    "Only the distance to the venue",
    "Only the music genre requested"
   ],
   "ans": 1
  },
  {
   "q": "Why is it essential to sign a written contract before any paid event?",
   "opts": [
    "It isn't essential — the word of a trusted promoter is enough",
    "The contract legally protects both parties: it sets out the agreed conditions, payment terms, cancellation consequences, and rights and obligations — without a contract, the DJ has no legal recourse in a dispute",
    "Only needed for large festivals — it doesn't apply to small events",
    "The contract only protects the client, not the DJ",
    "Verbal contracts carry the same legal weight in music"
   ],
   "ans": 1
  },
  {
   "q": "What should a professional DJ service contract include at a minimum?",
   "opts": [
    "Only the DJ's name and the amount to be paid",
    "Information on both parties, event date/time/location, set length, total fee and payment method, required deposit percentage, cancellation policy and penalties, technical rider included",
    "Only the date and the money",
    "Only the technical rider",
    "Only the promoter's signature"
   ],
   "ans": 1
  },
  {
   "q": "What is the purpose of the 'deposit' (down payment) in a DJ contract, and how much is it usually?",
   "opts": [
    "It's optional — only collected for very important events",
    "The deposit reserves the date and is non-refundable if the client cancels — usually between 25% and 50% of the agreed total, it protects the DJ from last-minute cancellations after turning down other offers",
    "It's a goodwill payment with no real contractual function",
    "The deposit is always refundable in every case",
    "Only collected for festivals — private events don't require a deposit"
   ],
   "ans": 1
  },
  {
   "q": "What does a professional cancellation clause establish in a DJ contract?",
   "opts": [
    "That the DJ can cancel at any time without consequences",
    "The terms under which the client or the DJ can cancel — normally the deposit is forfeited if the client cancels, and if the DJ cancels without force majeure, they must return the deposit and potentially pay a penalty",
    "It only applies to client cancellations — the DJ can always cancel",
    "It doesn't need to be included — it gets sorted out on the spot",
    "Cancellations are always free of charge for both parties"
   ],
   "ans": 1
  },
  {
   "q": "What is the 'force majeure' clause in a service contract?",
   "opts": [
    "The DJ's right to charge more if more people show up than expected",
    "A clause that releases both parties from their contractual obligations if an event occurs beyond the control of either party — natural disaster, pandemic, government cancellation of the event",
    "The DJ's right to end the set if there are technical problems",
    "It only applies if the DJ gets sick — not to external situations",
    "A clause that only protects the client in emergencies"
   ],
   "ans": 1
  },
  {
   "q": "What are performance rights (public performance rights) and how do they affect the DJ?",
   "opts": [
    "They are the DJ's rights to record tracks in their own studio",
    "The right of authors/composers/labels to receive compensation when their music is played publicly — in most countries, the venue (not the DJ) is responsible for holding the PRO licenses (ASCAP, BMI, SESAC in the US) that cover public performance",
    "They are rights the DJ charges promoters for using their mixes",
    "The DJ is always personally responsible for licenses in every case",
    "DJs have no obligations related to copyright"
   ],
   "ans": 1
  },
  {
   "q": "What is an invoice in the DJ business and why is it important to issue one?",
   "opts": [
    "An informal receipt that you can give or not give to the client",
    "A formal document stating the service provided, the amount, the date, and the tax information — it's the accounting and legal record of the payment, needed to report income, deduct expenses, and operate as an independent professional",
    "Only necessary for events over $1,000",
    "Only the venue issues it — not the DJ",
    "Invoices only apply to companies, not to independent DJs"
   ],
   "ans": 1
  },
  {
   "q": "What is the difference between getting paid 'cash with no invoice' and operating formally as a registered professional?",
   "opts": [
    "There's no difference — cash is more convenient and equivalent",
    "Without formal registration, the DJ operates in the informal economy, with no legal protection, no access to tax deductions, no credit history, and a risk of penalties — operating formally protects and builds professional and financial reputation over the long term",
    "Cash is always preferable because banks charge fees",
    "It only matters if the DJ earns more than $5,000 a year",
    "Formal registration is only necessary for DJs at international festivals"
   ],
   "ans": 1
  },
  {
   "q": "What is the typical minimum fee for a certified professional DJ at a private event (wedding, corporate) in the Miami market?",
   "opts": [
    "$50-$100 — the market doesn't pay more",
    "$500-$1,500+ depending on length, experience, and type of event — a certified DJ with professional equipment and a contract in Miami can charge significantly more at high-budget weddings",
    "$200 for any event — a fixed market price",
    "Only charged by the hour — never a flat rate",
    "The Miami market doesn't allow charging more than $300 per event"
   ],
   "ans": 1
  },
  {
   "q": "What is an 'exclusivity clause' in a club residency contract?",
   "opts": [
    "The DJ must play exclusively electronic music",
    "An agreement in which the DJ commits not to play at direct competitor venues during the residency period — it can limit other income, so it should be negotiated carefully with clear geographic and time limits",
    "The club can drop the DJ at any time without pay",
    "The clause that prohibits the DJ from using social media",
    "Only applies to contracts longer than one year"
   ],
   "ans": 1
  },
  {
   "q": "Why should a DJ include a 'backup equipment' section in their technical rider and contract?",
   "opts": [
    "To impress the promoter with a longer document",
    "So the contract specifies who is responsible if the venue's equipment fails — if the venue doesn't provide the equipment agreed in the rider, the DJ has contractual grounds to claim compensation or modify the agreement without penalty",
    "Backup equipment only matters at festivals with more than 5,000 people",
    "The technical rider is never part of the legal contract",
    "So the DJ can charge extra for bringing additional equipment"
   ],
   "ans": 1
  },
  {
   "q": "What does 'net 30' mean in payment terms for service contracts?",
   "opts": [
    "The DJ collects 30% of the total before the event",
    "The client has 30 days from the date of service to make the full payment — in DJing, it's more common to require full payment or the balance on the day of the event, but this term can apply to corporate gigs",
    "30% automatically goes to copyright royalties",
    "The payment is split into 30 monthly installments",
    "Net 30 means the price goes up 30% if it isn't paid before the event"
   ],
   "ans": 1
  },
  {
   "q": "What is the tactical difference between a DJ who quotes in person vs. by chat/email?",
   "opts": [
    "There's no difference — the quote is the same through any channel",
    "In person (or on a video call), the DJ can read the client's profile, tailor the pitch and price to the event, and build rapport that justifies a higher fee — by email, you can only respond to the requested price without knowing the value the client perceives",
    "You always get higher prices by email",
    "In person, the DJ always charges less because of social pressure",
    "Quoting via WhatsApp is more effective than any other channel"
   ],
   "ans": 1
  },
  {
   "q": "Why should a DJ keep a record of all their contracts and payments received?",
   "opts": [
    "Only for personal organization — no real consequences if they don't",
    "For financial control, accurate tax filing, a client history for marketing, and legal defense in case of disputes — a DJ who doesn't keep records can't grow as a business or protect themselves legally",
    "Only necessary if the DJ has employees",
    "The promoter keeps the records — not the DJ's responsibility",
    "Only matters if the DJ earns more than $10,000 a year"
   ],
   "ans": 1
  },
  {
   "q": "What is a 'buyout' in a DJ club contract and how does it protect both parties?",
   "opts": [
    "A system where the crowd pays the DJ directly",
    "A flat fee agreed before the event — the club pays a fixed amount regardless of attendance, and the DJ knows exactly what they'll earn — it protects the DJ from door-sales variability and the club from unpredictable variable costs",
    "A buyout is only for internationally known DJs",
    "An extra payment the DJ receives if the crowd exceeds a certain size",
    "A commission system based on the bar tab generated"
   ],
   "ans": 1
  }
 ],
 "Q11": [
  {
   "q": "What are the key criteria for choosing a good DJ stage name?",
   "opts": [
    "Always use your full real name — it's more authentic",
    "It should be memorable, easy to pronounce in the target market, unique (check that no other DJ has that name), searchable on Google, and you should check domain and social media handle availability",
    "Use very long, descriptive names — more information is better",
    "The name doesn't matter — only the music matters",
    "Copy the style of a famous DJ to piggyback on their search traffic"
   ],
   "ans": 1
  },
  {
   "q": "What is an EPK (Electronic Press Kit) and when does a DJ need one?",
   "opts": [
    "A physical kit of stickers and marketing materials for clubs",
    "A professional digital document containing the DJ's bio, high-quality photos, reference setlists or mixes, technical rider, logos, and contact info — sent to promoters, festivals, and media when the DJ wants bookings or press",
    "Only internationally known DJs need one",
    "A promotional video on YouTube — not a document",
    "A special contract for media outlets"
   ],
   "ans": 1
  },
  {
   "q": "What are the essential elements of a professional DJ EPK?",
   "opts": [
    "Only a photo and a WhatsApp number",
    "Professional bio (short and long versions), high-resolution professional photos, an audio sample (mix or tracks), technical rider, genres and BPM range of the set, logos in vector formats, and booking contact",
    "Only the setlist from the last set",
    "Only the DJ's social media accounts",
    "The EPK is optional — promoters don't ask for it"
   ],
   "ans": 1
  },
  {
   "q": "What sets a professional DJ bio apart from a casual description?",
   "opts": [
    "A professional bio is always written in the first person ('I've been a DJ since...')",
    "A professional bio is written in the third person and mentions verifiable achievements (residencies, events, genres), with 50-word and 150-word versions adaptable to different contexts — clubs, festivals, press, and websites",
    "A professional bio always includes the DJ's full real name",
    "It should be as long as possible — more detail is better",
    "The casual bio and the professional one are the same — only the format changes"
   ],
   "ans": 1
  },
  {
   "q": "What is the 70/30 rule in a DJ's social media content strategy?",
   "opts": [
    "Post 70% your own music and 30% other people's",
    "70% value and entertainment content related to music/DJ culture (behind the scenes, technique, music selection, culture), and 30% direct promotion (dates, bookings, new tracks) — it avoids follower fatigue from constant self-promotion",
    "Post 70% photos and 30% video",
    "Have 70% real followers and 30% bought ones",
    "Post 70% in English and 30% in Spanish"
   ],
   "ans": 1
  },
  {
   "q": "Why does visual consistency (colors, typography, photo style) matter in a DJ's branding?",
   "opts": [
    "It doesn't — content is the only thing that matters on social media",
    "Visual consistency creates instant brand recognition — when a follower scrolls and sees your post, they should recognize it before seeing the DJ's name, building a brand presence that translates into more bookings and credibility",
    "It only matters for DJs with brand sponsors",
    "Consistency is purely aesthetic — it doesn't affect bookings or reputation",
    "It only matters on visual platforms like Instagram — not on others"
   ],
   "ans": 1
  },
  {
   "q": "What is the main platform for a DJ looking to establish themselves in the club electronic market (house, techno)?",
   "opts": [
    "TikTok — it's the only relevant platform for DJs in 2024",
    "SoundCloud + Mixcloud for uploading sets, Resident Advisor for bio and events, and Instagram for visual content — the electronic club ecosystem lives mainly outside of TikTok",
    "Only Instagram Reels — set audio doesn't work on any other platform",
    "Facebook exclusively — club promoters only use Facebook",
    "YouTube is the only platform where DJs can legally upload mixes"
   ],
   "ans": 1
  },
  {
   "q": "What is a 'promo mix' and what is its role in the booking circuit?",
   "opts": [
    "A mix the DJ sells to their followers",
    "A 30-60 minute mix that faithfully represents the DJ's style and is sent to promoters and bookers to land bookings — it's the DJ's 'sonic business card' and must reflect exactly the sound of the live set",
    "A test mix to practice before the real set",
    "An illegal mix of unlicensed tracks for private distribution",
    "Only used to apply to international festivals — not for local clubs"
   ],
   "ans": 1
  },
  {
   "q": "Why should a DJ have their own website in addition to their social media?",
   "opts": [
    "Websites are obsolete — only social media matters in 2024",
    "The website is the brand's control center — an owned asset that doesn't depend on third-party algorithms, where the DJ can present their EPK, schedule, music, booking contact, and full bio without platform restrictions",
    "Only DJs with more than 50,000 followers need one",
    "It's only for DJs who produce their own music",
    "Promoters never visit websites — they only use Instagram"
   ],
   "ans": 1
  },
  {
   "q": "What is the most common branding mistake beginner DJs make on social media?",
   "opts": [
    "Posting too much quality content",
    "Posting inconsistently, mixing stage names with personal life, not having a clear sound identity, and copying other DJs' visual style — brand confusion reduces credibility with promoters and fans",
    "Being on too many platforms at once",
    "Using professional photography from the start — it's too early",
    "Posting educational content — followers don't want to learn"
   ],
   "ans": 1
  },
  {
   "q": "What is 'niche positioning' in DJ branding and why is it effective?",
   "opts": [
    "Playing only small venues so you don't compete with big DJs",
    "Specializing in a specific genre (e.g. Afrohouse, Reggaeton, Tech-House) and a type of event — a clear niche makes specific promoters seek you out directly instead of comparing you to any generic DJ",
    "A niche limits opportunities — DJs should be generalists",
    "It only works in very large markets like New York or Ibiza",
    "A niche is a mistake — variety generates more bookings"
   ],
   "ans": 1
  },
  {
   "q": "Why is professional photography a justified investment in a DJ's branding?",
   "opts": [
    "It's an unnecessary expense — today's phones are good enough",
    "Photos are the first visual point of contact with promoters and media — a professional photo communicates standard, seriousness, and the level of the brand before anyone hears a track — it directly affects the perceived value and the fee",
    "It only matters if the DJ is looking to be featured in magazines",
    "Fan photos from social media are enough and more authentic",
    "Only DJs who produce music need professional photos"
   ],
   "ans": 1
  },
  {
   "q": "What is the difference between organic followers and bought followers, and why does it matter?",
   "opts": [
    "There's no difference — the total number is what matters to promoters",
    "Organic followers generate real engagement (comments, plays, event attendance) that promoters and platforms value — bought followers are inactive accounts that wreck the engagement rate and can be spotted by professional promoters",
    "Bought followers are worth more because they raise the count quickly",
    "Promoters only look at the total number — not the engagement",
    "Buying followers is a standard practice in the music industry"
   ],
   "ans": 1
  },
  {
   "q": "What contact information should always be visible on the DJ's profiles and EPK?",
   "opts": [
    "Only the DJ's Instagram",
    "Booking email (preferably name@yourdomain.com), a professional WhatsApp number separate from the personal one, and if applicable, the agency or management name — making contact easy reduces friction for receiving offers",
    "Only a contact form on the website — no direct email",
    "Only the personal phone number",
    "Contact info is only provided when asked — not publicly"
   ],
   "ans": 1
  },
  {
   "q": "Why should a DJ separate their brand from their personal life on social media?",
   "opts": [
    "For privacy — but it doesn't affect their professional career",
    "Mixing the brand with personal content (politics, private life, conflicts) creates brand noise, can drive away promoters and sponsors, and weakens the professional image — the DJ's brand should be aspirational and consistent with the musical niche",
    "Promoters prefer more 'authentic' DJs with a visible personal life",
    "It only matters for DJs seeking sponsorships from major brands",
    "Past 10,000 followers, the separation is no longer necessary"
   ],
   "ans": 1
  }
 ],
 "EXAM_QUESTIONS": [
  {
   "q": "What is the main function of EQ when mixing two songs?",
   "a": "A) Raising the track's volume so it sounds louder",
   "b": "B) Controlling the frequencies (lows, mids, highs) for a smooth transition without sonic clashes",
   "c": "C) Automatically changing the song's tempo (BPM)",
   "correct": "b"
  },
  {
   "q": "A client requests 'Top 40' music for a wedding. What does this mean?",
   "a": "A) The 40 longest songs in the library",
   "b": "B) Old songs from the 1940s",
   "c": "C) The most popular songs on the current charts (commercial pop)",
   "correct": "c"
  },
  {
   "q": "What is 'beatmatching' and why is it fundamental?",
   "a": "A) Matching the BPM of two songs so they play in sync when mixing",
   "b": "B) Choosing songs by the same artist so they go together",
   "c": "C) A sound effect that adds echo to the mix",
   "correct": "a"
  },
  {
   "q": "You're at an event with 300 people and the audio cuts out. What is the correct protocol?",
   "a": "A) Improvise with your phone and Bluetooth speakers while it gets fixed",
   "b": "B) Stay calm, use the microphone to let the crowd know, identify the fault (cable, breaker, etc.), and fix it within 90 seconds at most with the backup plan active",
   "c": "C) Call the client to apologize and wait for an outside technician to arrive",
   "correct": "b"
  },
  {
   "q": "What is the difference between a 'technical rider' and a DJ service contract?",
   "a": "A) They're the same document with different names",
   "b": "B) The technical rider specifies equipment and space requirements; the contract sets out the legal terms, payment, and event conditions",
   "c": "C) The rider is for large events and the contract is only for weddings",
   "correct": "b"
  },
  {
   "q": "A new client asks your rate and then says 'another DJ charges $200 less.' What is the best professional response?",
   "a": "A) Immediately lower the price so you don't lose the client",
   "b": "B) Explain what sets your service apart (experience, equipment, insurance, backup plan) without getting into a price war",
   "c": "C) Ignore the comment and repeat your original price with no further explanation",
   "correct": "b"
  },
  {
   "q": "What does the term 'phrasing' mean in professional mixing?",
   "a": "A) Mixing songs from the same genre only",
   "b": "B) Adding MC vocal lines between songs",
   "c": "C) Syncing transitions with the song's musical structure (every 8, 16, or 32 beats) so the mix sounds natural",
   "correct": "c"
  },
  {
   "q": "For a wedding with 150 guests in an enclosed 30x20 m space, which audio setup is most suitable?",
   "a": "A) A single 15-inch speaker in the center of the room",
   "b": "B) A system of two powered tops + a subwoofer, set up in stereo and positioned at the corners of the dance floor area for even coverage",
   "c": "C) Passive speakers with no external amplifier to save on gear",
   "correct": "b"
  },
  {
   "q": "What is 'harmonic mixing'?",
   "a": "A) Mixing songs in the same musical key so they don't clash tonally",
   "b": "B) Mixing only classical music with electronic music",
   "c": "C) Gradually raising the volume over 30 minutes at the start of the event",
   "correct": "a"
  },
  {
   "q": "According to Miami DJ Beat's policies, when must the minimum deposit be received to confirm a date?",
   "a": "A) On the day of the event",
   "b": "B) Within 72 hours of signing the contract for the date to be officially considered booked",
   "c": "C) The deposit is optional and can be paid after the event",
   "correct": "b"
  }
 ]
}
  ;
  window.mdjBindQ = function (arr, key, rerender) {
    var es = arr.slice();
    function apply() {
      var src = (lang() === 'en' && EN[key]) ? EN[key] : es;
      arr.splice(0, arr.length);
      Array.prototype.push.apply(arr, src);
    }
    apply();
    document.addEventListener('languageChanged', function () {
      apply();
      if (rerender) { try { rerender(); } catch (e) { /* la página aún no pintó ese módulo */ } }
    });
  };
})();
