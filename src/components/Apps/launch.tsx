// What each app draws in its window, by id (apps.ts lists them). Only the
// window manager calls this (openApp and showApp in WindowContext.tsx).
import type { ReactElement } from 'react';
import type { AppId, AppRequest } from './apps';
import Finder from './Finder/Finder';
import Safari from './Safari/Safari';
import NasaNews from './NasaNews/NasaNews';
import PokemonSearch from './PokemonSearch/PokemonSearch';
import FieldGuide from './FieldGuide/FieldGuide';
import Music from './Music/Music';
import Notes from './Notes/Notes';
import Camera from './Camera/Camera';
import Calculator from './Calculator/Calculator';
import Terminal from './Terminal/Terminal';
import Preferences from './Preferences/Preferences';
import Trash from './Trash/Trash';
import AboutThisMac from './AboutThisMac/AboutThisMac';
import ForceQuit from './ForceQuit/ForceQuit';

/**
 * The element for an app's window. `request` is what the caller asked for
 * (Preferences' pane), and `requestNumber` changes with every request, so an
 * open window handed the same request again still acts on it.
 */
export const launchApp = (id: AppId, request?: AppRequest, requestNumber?: number): ReactElement => {
  switch (id) {
    case 'finder': return <Finder />;
    case 'safari': return <Safari />;
    case 'nasa': return <NasaNews />;
    case 'pokemon': return <PokemonSearch />;
    case 'fieldguide': return <FieldGuide />;
    case 'music': return <Music />;
    case 'notes': return <Notes />;
    case 'camera': return <Camera />;
    case 'calculator': return <Calculator />;
    case 'terminal': return <Terminal />;
    case 'preferences': return <Preferences pane={request?.pane} request={requestNumber} />;
    case 'trash': return <Trash />;
    case 'about': return <AboutThisMac />;
    case 'forcequit': return <ForceQuit />;
  }
};
