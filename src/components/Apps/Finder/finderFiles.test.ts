import { describe, expect, it } from 'vitest';
import { APPS } from '../apps';
import { HOME, PLACES, allNodes, findFolder, findNode, itemCount, pathTo } from './finderFiles';

describe('Finder\'s disk', () => {
  const nodes = allNodes();

  it('gives every node its own id', () => {
    const ids = nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('opens a real app for every project', () => {
    const appIds = new Set<string>(APPS.map(a => a.id));
    for (const node of nodes) if (node.kind === 'app') expect(appIds.has(node.app), node.name).toBe(true);
  });

  it('has a project for every app in the Dock but the Trash and Finder itself', () => {
    const projects = new Set(nodes.flatMap(n => (n.kind === 'app' ? [n.app] : [])));
    for (const app of APPS) if (app.inDock && app.id !== 'trash' && app.id !== 'finder') expect(projects.has(app.id), app.name).toBe(true);
  });

  it('gives every project a note on what it is', () => {
    for (const node of nodes) if (node.kind === 'app') expect(node.about.length, node.name).toBeGreaterThan(10);
  });

  it('links only to https pages', () => {
    for (const node of nodes) if (node.kind === 'link') expect(node.url).toMatch(/^https:\/\//);
  });

  it('finds the path down to a node', () => {
    expect(pathTo('project-terminal').map(n => n.id)).toEqual(['home', 'projects', 'utilities', 'project-terminal']);
    expect(pathTo('home').map(n => n.id)).toEqual(['home']);
    expect(pathTo('nowhere')).toEqual([]);
    expect(findNode('doc-about')?.name).toBe('About Me.txt');
  });

  it('falls back on the home folder for anything that is not a folder', () => {
    expect(findFolder('doc-about')).toBe(HOME);
    expect(findFolder('nowhere')).toBe(HOME);
    expect(findFolder('projects').name).toBe('Projects');
  });

  it('puts only folders in the sidebar', () => {
    for (const place of PLACES) expect(place.kind).toBe('folder');
  });

  it('counts items as Finder does', () => {
    expect(itemCount({ id: 'x', kind: 'folder', name: 'x', children: [] })).toBe('0 items');
    expect(itemCount({ id: 'x', kind: 'folder', name: 'x', children: [HOME] })).toBe('1 item');
  });
});
