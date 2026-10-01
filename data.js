/* Ecosystem Fire – prototype data (MOCK, deterministic).
 * All numbers are fictitious placeholders transcribed from the Figma
 * screenshots (f1-04 compact values). No real data, no backend.
 * Cell tuple: [value, capacity] for day offset 0 / full day.
 * Per-shift split (1/2/3) is generated deterministically in app.js,
 * except for cells listed in `shiftOverrides` (warning / alert cells
 * whose bars are specified in the Figma screenshots).
 */
window.EF_DATA = {
  units: [
    { id: 'u36',  name: 'אוג׳ 36', sub: '4 חטיבות',     kind: 'ugda' },
    { id: 'u282', name: 'חט׳ 282', sub: 'משימה א/4',    kind: 'unit' },
    { id: 'u7',   name: 'חט׳ 7',   sub: 'כיבוש ציר...', kind: 'unit' },
    { id: 'u188', name: 'חט׳ 188', sub: 'תקיפה דאחייה', kind: 'unit' },
    { id: 'u1',   name: 'חט׳ 1',   sub: 'משימה א/2',    kind: 'unit' }
  ],

  // Groups in RTL order (first = rightmost). Each column: label (bars),
  // short label (compact "123"), and 5 rows (ugda row first).
  groups: [
    {
      id: 'art', title: 'ארטילריה', icon: 'assets/t-0d210.svg', iconSize: 16,
      columns: [
        { id: 'art-hx',  label: 'נפיץ',           short: 'נפיץ',         rows: [[590,1355],[100,150],[202,280],[234,458],[100,150]] },
        { id: 'art-hxl', label: 'נפיץ ארוך טווח', short: 'נפיץ ארוך ט.', rows: [[234,2056],[234,458],[100,150],[18,1355],[100,150]] },
        { id: 'art-sw',  label: 'עשן לבן',        short: 'עשן לבן',      rows: [[342,2223],[255,300],[202,280],[255,300],[18,125]] },
        { id: 'art-sg',  label: 'עשן אפור',       short: 'עשן אפור',     rows: [[945,1676],[202,280],[255,1355],[100,150],[96,125]] },
        { id: 'art-il',  label: 'תאורה',          short: 'תאורה',        rows: [[879,5433],[98,125],[100,150],[18,1355],[234,458]] }
      ]
    },
    {
      id: 'air', title: 'אוויר', icon: 'assets/t-aa81e.svg', iconHover: 'assets/plane-hdr.svg', iconSize: 16,
      columns: [
        { id: 'air-b84', label: 'ברד כבד 84', short: 'ברד כ. 84', rows: [[342,4577],[100,150],[234,458],[202,280],[202,280]] },
        { id: 'air-b82', label: 'ברד כבד 82', short: 'ברד כ. 82', rows: [[233,7688],[255,300],[202,280],[100,150],[255,300]] },
        { id: 'air-zk',  label: 'זיקית',      short: 'זיקית',     rows: [[125,4556],[255,300],[255,300],[234,458],[100,150]] },
        { id: 'air-sk',  label: 'ש״כ',        short: 'ש״כ',       rows: [[356,2288],[100,150],[234,458],[100,150],[202,280]] }
      ]
    },
    {
      id: 'nmd', title: 'נמ״ד', icon: 'assets/t-418b1.svg', iconSize: 14,
      columns: [
        { id: 'nmd-rm', label: 'רומח',    short: 'רומח',    rows: [[245,2467],[202,280],[18,1355],[18,1355],[255,300]] },
        { id: 'nmd-br', label: 'בר',      short: 'בר',      rows: [[245,3344],[18,1355],[255,300],[100,150],[202,280]] },
        { id: 'nmd-mk', label: 'מכחולית', short: 'מכחולית', rows: [[865,1200],[255,300],[255,300],[234,458],[18,1355]] },
        { id: 'nmd-yv', label: 'יואב',    short: 'יואב',    rows: [[453,5700],[18,125],[18,1355],[202,280],[234,458]] },
        { id: 'nmd-pg', label: 'פיגיון',  short: 'פיגיון',  rows: [[247,3230],[255,300],[202,280],[130,150],[202,280]] }
      ]
    },
    {
      // ASSUMPTION: a 4th group is partially visible at the far left of the
      // Figma screens (columns only, its title is never visible). Title is a
      // placeholder.
      id: 'etc', title: 'נוספים', icon: null, iconSize: 0,
      columns: [
        { id: 'etc-an', label: 'עננ״ס',     short: 'עננ״ס',   rows: [[410,1800],[100,150],[202,280],[18,125],[255,300]] },
        { id: 'etc-sn', label: 'סנונית',    short: 'סנונית',  rows: [[288,2100],[234,458],[100,150],[255,300],[18,1355]] },
        { id: 'etc-dh', label: 'דוהר אדום', short: 'דוהר א.', rows: [[512,3050],[18,1355],[234,458],[100,150],[202,280]] }
      ]
    }
  ],

  // Explicit per-shift [value, capacity] for cells whose bar state is
  // designed in Figma. key = columnId + ':' + rowIndex.
  //  - warning (yellow bar, >= 85% of shift capacity)
  //  - alert   (red outline, a shift exceeds its capacity)
  shiftOverrides: {
    'art-il:1':  [[38,43],[30,42],[30,40]],     // yellow bar 1 (f1-01)
    'art-hxl:2': [[30,52],[40,45],[30,53]],     // yellow bar 2
    'art-sg:4':  [[30,45],[30,42],[36,38]],     // yellow bar 3
    'nmd-rm:1':  [[60,100],[84,95],[58,85]],    // yellow bar 2
    'nmd-mk:2':  [[80,110],[88,100],[87,90]] ,  // yellow bar 2
    'nmd-pg:3':  [[52,56],[40,50],[38,44]],     // yellow bar 1
    'art-hx:2':  [[98,90],[60,100],[44,90]]     // ALERT shift 1 exceeded
    // Ugda row (index 0) is computed in app.js as the sum of the unit rows;
    // its values in `rows` above are ignored.
  },

  // Form options
  ammo: [
    { id: 'art', label: 'ארטילריה', icon: 'assets/t-0d210.svg' },
    { id: 'air', label: 'אוויר',    icon: 'assets/t-aa81e.svg' },
    { id: 'nmd', label: 'נמ״ד',     icon: 'assets/t-418b1.svg' }
  ],
  ammoTypes: {
    art: [
      { label: 'נפיץ',           col: 'art-hx' },
      { label: 'נפיץ ארוך טווח', col: 'art-hxl' },
      { label: 'עשן לבן',        col: 'art-sw' },
      { label: 'עשן אפור',       col: 'art-sg' },
      { label: 'תאורה',          col: 'art-il' }
    ],
    air: [
      { label: 'ברד כבד 84', col: 'air-b84' },
      { label: 'ברד כבד 82', col: 'air-b82' },
      { label: 'זיקית',      col: 'air-zk' },
      { label: 'ש״כ',        col: 'air-sk' }
    ],
    nmd: [
      { label: 'רומח',    col: 'nmd-rm' },
      { label: 'בר',      col: 'nmd-br' },
      { label: 'מכתולית', col: 'nmd-mk' },
      { label: 'יואב',    col: 'nmd-yv' },
      { label: 'פיניון',  col: 'nmd-pg' }
    ]
  },

  shifts: [
    { id: 1, label: '06:00 - 14:00' },
    { id: 2, label: '14:01 - 19:00' },
    { id: 3, label: '19:01 - 06:00' }
  ]
};
