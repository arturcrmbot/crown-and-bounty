import { describe, expect, it } from 'vitest';
import { ARTIFACTS, type ArtifactId } from '../content/artifacts';
import { artifactIcon, ICON_SIZE } from './artifactIcons';
import { MORE_PICTURES } from './artifactPictures';

describe('artifact pictures', () => {
  it('draw every artifact as itself, so no two in the pack look alike', () => {
    const drawn = new Map<string, ArtifactId>();
    for (const id of Object.keys(ARTIFACTS) as ArtifactId[]) {
      const key = artifactIcon(id).data.join();
      expect(drawn.get(key), `${id} looks just like ${drawn.get(key)}`).toBeUndefined();
      drawn.set(key, id);
    }
  });

  it('are 16 letters square', () => {
    for (const [id, rows] of Object.entries(MORE_PICTURES)) {
      expect(rows.length, id).toBe(ICON_SIZE);
      for (const row of rows) expect(row.length, `${id}: ${row}`).toBe(ICON_SIZE);
    }
  });
});
