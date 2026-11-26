import { GrooveStyle, SongAssignments, SongStatus } from '../types';

export const STARTER_ROSTER: string[] = [
  'Shaun',
  'Zid',
  'Roy',
  'Rian',
  'Luana',
  'Davs',
  'Jai',
  'Aleyah',
];

export interface StarterSongTemplate {
  orderIndex: number;
  title: string;
  artist: string;
  recommendedBy: string;
  referenceUrl: string;
  chordsUrl: string;
  lyricsUrl: string;
  keyChord: string;
  bpm: number;
  status: SongStatus;
  grooveStyle: GrooveStyle;
  chordProgression: string[];
  lyricsWithChords: string;
  assignments: SongAssignments;
}

export const STARTER_SONGS: StarterSongTemplate[] = [
  {
    orderIndex: 1,
    title: 'Sweet Child O Mine',
    artist: 'Guns N Roses (cover by First to Eleven)',
    recommendedBy: 'Shaun',
    referenceUrl: 'https://www.youtube.com/results?search_query=Sweet+Child+O+Mine+First+to+Eleven',
    chordsUrl: 'https://www.ultimate-guitar.com/search.php?search_type=title&value=Sweet+Child+O+Mine',
    lyricsUrl: 'https://genius.com/search?q=Sweet+Child+O+Mine+Guns+N+Roses',
    keyChord: 'D',
    bpm: 125,
    status: 'confirmed',
    grooveStyle: 'rock',
    chordProgression: ['D', 'D', 'C', 'C', 'G', 'G', 'D', 'D'],
    lyricsWithChords: '',
    assignments: {
      vocals1: '',
      vocals2: '',
      vocals3: '',
      keyboard1: '',
      guitar1: 'Zid',
      guitar2: '',
      guitar3: '',
      bass: '',
      percussion1: 'Roy',
      percussion2: '',
    },
  },
  {
    orderIndex: 2,
    title: 'Marilag',
    artist: 'Dionela',
    recommendedBy: 'Shaun',
    referenceUrl: 'https://www.youtube.com/results?search_query=Marilag+Dionela',
    chordsUrl: 'https://www.ultimate-guitar.com/search.php?search_type=title&value=Marilag+Dionela',
    lyricsUrl: 'https://genius.com/search?q=Marilag+Dionela',
    keyChord: 'G',
    bpm: 86,
    status: 'rehearsing',
    grooveStyle: 'pop',
    chordProgression: ['Gmaj7', 'Em7', 'Cmaj7', 'D7'],
    lyricsWithChords: '',
    assignments: {
      vocals1: 'Rian',
      vocals2: 'Luana',
      vocals3: 'Shaun',
      keyboard1: 'Davs',
      guitar1: 'Shaun',
      guitar2: '',
      guitar3: '',
      bass: '',
      percussion1: '',
      percussion2: '',
    },
  },
  {
    orderIndex: 3,
    title: 'Parting Time',
    artist: 'Rockstar',
    recommendedBy: 'Jai',
    referenceUrl: 'https://www.youtube.com/results?search_query=Parting+Time+Rockstar',
    chordsUrl: 'https://www.ultimate-guitar.com/search.php?search_type=title&value=Parting+Time+Rockstar',
    lyricsUrl: 'https://genius.com/search?q=Parting+Time+Rockstar',
    keyChord: 'F',
    bpm: 74,
    status: 'considering',
    grooveStyle: 'ballad',
    chordProgression: ['F', 'C/E', 'Dm', 'Bb', 'Gm', 'C', 'F', 'C'],
    lyricsWithChords: '',
    assignments: {
      vocals1: 'Jai',
      vocals2: '',
      vocals3: '',
      keyboard1: '',
      guitar1: '',
      guitar2: '',
      guitar3: '',
      bass: '',
      percussion1: '',
      percussion2: '',
    },
  },
  {
    orderIndex: 4,
    title: 'Hotel California',
    artist: 'The Eagles',
    recommendedBy: 'Shaun',
    referenceUrl: 'https://www.youtube.com/results?search_query=Hotel+California+The+Eagles',
    chordsUrl: 'https://www.ultimate-guitar.com/search.php?search_type=title&value=Hotel+California',
    lyricsUrl: 'https://genius.com/search?q=Hotel+California+Eagles',
    keyChord: 'Bm',
    bpm: 75,
    status: 'rehearsing',
    grooveStyle: 'rock',
    chordProgression: ['Bm', 'F#', 'A', 'E', 'G', 'D', 'Em', 'F#'],
    lyricsWithChords: '',
    assignments: {
      vocals1: '',
      vocals2: '',
      vocals3: '',
      keyboard1: '',
      guitar1: 'Aleyah',
      guitar2: 'Zid',
      guitar3: '',
      bass: '',
      percussion1: '',
      percussion2: '',
    },
  },
  {
    orderIndex: 5,
    title: 'Where the Streets Have No Name',
    artist: 'U2',
    recommendedBy: 'Roy',
    referenceUrl: 'https://www.youtube.com/results?search_query=Where+the+Streets+Have+No+Name+U2',
    chordsUrl: 'https://www.ultimate-guitar.com/search.php?search_type=title&value=Where+the+Streets+Have+No+Name',
    lyricsUrl: 'https://genius.com/search?q=Where+the+Streets+Have+No+Name+U2',
    keyChord: 'D',
    bpm: 126,
    status: 'confirmed',
    grooveStyle: 'anthem',
    chordProgression: ['D', 'D', 'G', 'G', 'Bm', 'A', 'D', 'D'],
    lyricsWithChords: '',
    assignments: {
      vocals1: '',
      vocals2: '',
      vocals3: '',
      keyboard1: '',
      guitar1: 'Zid',
      guitar2: '',
      guitar3: '',
      bass: '',
      percussion1: 'Roy',
      percussion2: '',
    },
  },
];
