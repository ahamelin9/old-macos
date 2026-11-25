// Finder's pretend disk: Alex's home folder, the documents in it, and a
// Projects folder holding every app on this site, each with a short note on
// what it is and how it's built. Double-clicking a project opens the real app.
// Pure data and lookups, so the tests can check it (finderFiles.test.ts).
//
// Everything here is public and shown on the site. Keep it true: each
// project's note is checked against the system-map skill, and anything about
// Alex comes from Alex.
import type { AppId } from '../apps';

/** A block of a document's text */
export type DocBlock =
  | { heading: string }
  | { text: string }
  | { list: string[] };

interface NodeBase {
  /** Stable and unique on the disk: history and selection key on it */
  id: string;
  name: string;
  /** One line, shown under the name in the info pane */
  summary?: string;
}

export interface FolderNode extends NodeBase {
  kind: 'folder';
  children: FinderNode[];
}

/** A text file: opens in its own window */
export interface DocumentNode extends NodeBase {
  kind: 'document';
  body: DocBlock[];
}

/** A project: one of the site's apps. Opening it opens the app */
export interface AppNode extends NodeBase {
  kind: 'app';
  app: AppId;
  /** What it does, a sentence or two */
  about: string;
  /** How it's built: the interesting parts */
  built: string[];
  /** The outside services it talks to, or none */
  services: string[];
}

/** An internet location (.webloc): opens the page in a new tab */
export interface LinkNode extends NodeBase {
  kind: 'link';
  url: string;
}

export type FinderNode = FolderNode | DocumentNode | AppNode | LinkNode;

export const KIND_LABEL: Record<FinderNode['kind'], string> = {
  folder: 'Folder',
  document: 'SimpleText document',
  app: 'Application',
  link: 'Internet location'
};

// ---- The projects: the in-depth apps first, then the small ones in Utilities

const SITE: AppNode = {
  id: 'project-macos',
  kind: 'app',
  app: 'about',
  name: 'macOS 1999',
  summary: 'This desktop: a late-90s Mac in the browser',
  about:
    'The desktop every other project runs in. Windows drag, resize, zoom and minimize into the Dock with a Scale effect; the Dock magnifies; the Apple menu has About This Mac, Force Quit, Sleep and Restart; and System Preferences changes the wallpaper, text size, highlight colour and light or dark mode.',
  built: [
    'React 19, TypeScript and Vite, with one shared set of design tokens, so every app looks like the same Mac in light and dark',
    'A small window manager of its own: every app opens in a 400×300 window and lays itself out from the window, not the screen, so each works at phone width too',
    'Hosted on Cloudflare Pages, with Pages Functions for the parts that need a server (the Spotify login, the planes data)',
    'A browser check for each app, run by one npm run check'
  ],
  services: []
};

const PROJECTS: AppNode[] = [
  {
    id: 'project-fieldguide',
    kind: 'app',
    app: 'fieldguide',
    name: 'Field Guide',
    summary: 'What lives near a place, and where a species lives',
    about:
      'A naturalist\'s field guide. Search Places lists the plants, fungi and animals seen around a place (it opens on your own location), with tabs by group, a radius, and counts of native, endemic and introduced species. Search Species shows where a plant or animal lives on a range map. Any species opens in the Specimen Inspector.',
    built: [
      'Live data from iNaturalist, with Wikipedia summaries and OpenStreetMap for places and maps (Leaflet)',
      'Works out whether a species is native, endemic or introduced to the place from iNaturalist\'s establishment data, state first, then country',
      'An "In season now" filter from past years\' sightings in this month, and infinite scroll',
      'Spot-checked against the live sources, so what it shows is right, not just plausible'
    ],
    services: ['iNaturalist', 'Wikipedia', 'Wikidata', 'OpenStreetMap (Nominatim and map tiles)']
  },
  {
    id: 'project-planes',
    kind: 'app',
    app: 'planes',
    name: 'Planes',
    summary: 'The aircraft over where you are, live',
    about:
      'A live map of the planes in the sky over a place, each drawn in the shape of its kind, with a filter by kind. Click one for its photo, airline, usual route, aircraft, altitude and speed, and a trail of where it has been. Find a Plane looks up any flight, tail number or aircraft type in the world, and Spotter\'s Picks has cards of remarkable aircraft.',
    built: [
      'Positions from adsb.lol through the site\'s own /api/planes Cloudflare Function, refreshed every 10 seconds and paused while the window is minimized',
      'Routes and aircraft details from adsbdb, photos from planespotters.net, stories from Wikipedia',
      'Leaflet maps with a shape for each kind of aircraft, and skeleton loaders while pictures arrive',
      'On a phone: bigger tap targets and the chosen plane as a sheet at the bottom'
    ],
    services: ['adsb.lol', 'adsbdb', 'planespotters.net', 'Wikipedia', 'Wikidata', 'OpenStreetMap (Photon, Nominatim and map tiles)']
  },
  {
    id: 'project-pokemon',
    kind: 'app',
    app: 'pokemon',
    name: 'Pokémon',
    summary: 'A Pokédex with forms, evolutions and a type chart',
    about:
      'Search any Pokémon by name, even misspelled, for its stats (in US units), its type chart, and its shiny look. The evolution chain is clickable, with each stage\'s Mega and Gigantamax forms hanging off it, and an "Other forms" row has the regional forms.',
    built: [
      'Fuzzy search with fuzzysort over every Pokémon\'s name',
      'Its own rules for which forms belong where, tested on their own',
      'Sprites from PokeAPI\'s GitHub'
    ],
    services: ['PokeAPI']
  },
  {
    id: 'project-nasa',
    kind: 'app',
    app: 'nasa',
    name: 'NASA News',
    summary: 'NASA\'s Astronomy Picture of the Day, and every day before it',
    about:
      'Today\'s Astronomy Picture of the Day, with its explanation and credit. The round ☰ opens a list of past days that loads more as you scroll, with a search box and a date box that go back to 1995.',
    built: [
      'NASA Science\'s WordPress API, which needs no key',
      'The list sits beside the picture in a wide window and slides over it in a narrow one'
    ],
    services: ['NASA Science']
  },
  {
    id: 'project-music',
    kind: 'app',
    app: 'music',
    name: 'Music',
    summary: 'A Spotify player with Alex\'s playlists',
    about:
      'Alex\'s playlists, played through Spotify. Log in with Spotify to play them right in the window (playback needs Spotify Premium).',
    built: [
      'Spotify\'s Web API and Web Playback SDK',
      'The login runs on Cloudflare Pages Functions, so the app\'s secret never reaches the browser, and an hour-old token refreshes itself',
      'A local FastAPI (Python) backend with the same routes, for development'
    ],
    services: ['Spotify']
  },
  {
    id: 'project-preferences',
    kind: 'app',
    app: 'preferences',
    name: 'System Preferences',
    summary: 'Wallpaper, light or dark, text size and the Dock',
    about:
      'Change the whole desktop: seven wallpapers or your own picture, light, dark or follow the computer, four text sizes, Blue or Graphite, the Dock\'s size and magnification, and the clock.',
    built: [
      'Every setting reaches every app through CSS custom properties, so no app reads a setting itself',
      'A small script in the page sets them before the first paint, so a returning visitor never sees the default flash first',
      'Your own picture is shrunk in the browser and kept in IndexedDB; nothing is uploaded'
    ],
    services: []
  }
];

const UTILITIES: AppNode[] = [
  {
    id: 'project-safari',
    kind: 'app',
    app: 'safari',
    name: 'Safari',
    summary: 'Web search',
    about: 'Searches the web and lists the results, with the words you searched for in bold.',
    built: ['Brave Search, through a Cloudflare Worker of Alex\'s that keeps the key off the page'],
    services: ['Brave Search']
  },
  {
    id: 'project-camera',
    kind: 'app',
    app: 'camera',
    name: 'Camera',
    summary: 'Take a picture with your webcam',
    about: 'A webcam preview; take a picture and save it as a JPEG.',
    built: ['The browser\'s getUserMedia; the camera turns off while the window is minimized'],
    services: []
  },
  {
    id: 'project-calculator',
    kind: 'app',
    app: 'calculator',
    name: 'Calculator',
    summary: 'A desk calculator',
    about: 'A desk calculator.',
    built: [],
    services: []
  },
  {
    id: 'project-terminal',
    kind: 'app',
    app: 'terminal',
    name: 'Terminal',
    summary: 'A pretend shell',
    about: 'A pretend shell: try help, ls, date and theme dark.',
    built: [],
    services: []
  }
];

// ---- Alex's documents. Facts about Alex come from Alex only.

const ABOUT_ME: DocumentNode = {
  id: 'doc-about',
  kind: 'document',
  name: 'About Me.txt',
  summary: 'Hello!',
  // Alex's own answers, 2026-11-25
  body: [
    { text: 'Hello! I\'m Alex Hamelin, a software engineer at AbbVie, based in Illinois.' },
    {
      text: 'I started out wanting to make video games. I was building them back in middle school, and websites by high school, so I went on to study computer science to learn more. Now it\'s my job.'
    },
    {
      text: 'What I enjoy most is the problem solving. There\'s almost always more than one way to solve a problem, and the interesting part is working out which one is the right one to take.'
    },
    { heading: 'About this desktop' },
    {
      text: 'I wanted one place to show several apps together, and a desktop was the natural fit. I went with an older Mac because it takes me back to where I started, making games on a friend\'s mom\'s computer. (I\'m not that old, I just like old tech.)'
    },
    {
      text: 'Everything in the Projects folder is something I built for myself. When I wish I could see something and can\'t find an app that does it the way I picture it, I make one. I use all of them. Field Guide is a favourite: it shows you plants and animals near you that you may never have noticed, and lets you dig into each one.'
    },
    { text: 'Double-click any project to open it, or click it once to read how it\'s built.' },
    { heading: 'Get in touch' },
    { text: 'The best way to reach me is LinkedIn. I don\'t check it every day, so give me a little while to reply.' }
  ]
};

const SKILLS: DocumentNode = {
  id: 'doc-skills',
  kind: 'document',
  name: 'Skills.txt',
  summary: 'What I work with',
  body: [
    { list: ['React / TypeScript', 'JavaScript', 'CSS', 'Node.js', 'REST API integration'] },
    { heading: 'Also on this site' },
    { list: ['Vite', 'Cloudflare Pages and Functions', 'Python (FastAPI)', 'Leaflet maps', 'OAuth (the Spotify login)'] }
  ]
};

const INTERESTS: DocumentNode = {
  id: 'doc-interests',
  kind: 'document',
  name: 'Interests.txt',
  summary: 'When I\'m not coding',
  body: [{ list: ['Coding', 'Gaming', 'Retro tech (DS, 3DS and the like)', 'Art', 'Pickleball', 'Golf'] }]
};

const LINKEDIN: LinkNode = {
  id: 'link-linkedin',
  kind: 'link',
  name: 'LinkedIn',
  summary: 'The best way to reach me',
  url: 'https://www.linkedin.com/in/alejandro-hamelin/'
};

const GITHUB: LinkNode = {
  id: 'link-github',
  kind: 'link',
  name: 'GitHub',
  summary: 'My GitHub, with this site\'s code',
  url: 'https://github.com/ahamelin9'
};

export const UTILITIES_FOLDER: FolderNode = {
  id: 'utilities',
  kind: 'folder',
  name: 'Utilities',
  summary: 'The smaller apps',
  children: UTILITIES
};

export const PROJECTS_FOLDER: FolderNode = {
  id: 'projects',
  kind: 'folder',
  name: 'Projects',
  summary: 'Every app on this site',
  children: [SITE, ...PROJECTS, UTILITIES_FOLDER]
};

/** The top of the disk: Alex's home folder */
export const HOME: FolderNode = {
  id: 'home',
  kind: 'folder',
  name: 'Alex',
  summary: 'My home folder',
  children: [ABOUT_ME, PROJECTS_FOLDER, SKILLS, INTERESTS, LINKEDIN, GITHUB]
};

/** The sidebar: places on the disk, then the web */
export const PLACES: FolderNode[] = [HOME, PROJECTS_FOLDER, UTILITIES_FOLDER];
export const WEB_LINKS: LinkNode[] = [LINKEDIN, GITHUB];

/** Every node on the disk, top down */
export const allNodes = (root: FinderNode = HOME): FinderNode[] =>
  root.kind === 'folder' ? [root, ...root.children.flatMap(child => allNodes(child))] : [root];

/** The folders from the top down to the node with this id, ending with it; empty if there is none */
export const pathTo = (id: string, root: FolderNode = HOME): FinderNode[] => {
  if (root.id === id) return [root];
  for (const child of root.children) {
    if (child.id === id) return [root, child];
    if (child.kind === 'folder') {
      const below = pathTo(id, child);
      if (below.length) return [root, ...below];
    }
  }
  return [];
};

export const findNode = (id: string): FinderNode | undefined => pathTo(id).at(-1);

export const findFolder = (id: string): FolderNode => {
  const node = findNode(id);
  return node?.kind === 'folder' ? node : HOME;
};

/** "1 item", "7 items": Finder's status line */
export const itemCount = (folder: FolderNode) =>
  `${folder.children.length} ${folder.children.length === 1 ? 'item' : 'items'}`;
