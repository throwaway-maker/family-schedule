// Starting data. Everything here is editable inside the app.
// Days use 0 = Sun, 1 = Mon ... 6 = Sat.
const SCHOOL = [2, 3, 4];
const HOME = [0, 1, 5, 6];
const ALL = [0, 1, 2, 3, 4, 5, 6];

function seedState() {
  return {
    v: 1,
    people: [
      { id: 'me', name: 'Me', color: '#0e6e5c', core: true, notes: '' },
      { id: 'husband', name: 'Husband', color: '#1f5f99', core: true, notes: '' },
      { id: 'eloise', name: 'Eloise', color: '#c47a12', core: true, notes: '' },
      { id: 'anaise', name: 'Anaise', color: '#c0466f', core: true, notes: 'Breastfed about every 3 hours.' },
      { id: 'chayote', name: 'Chayote', color: '#4f8a1f', core: true, notes: '' },
      { id: 'nainai', name: 'Nainai', color: '#6a4fb0', core: false, notes: '' },
      { id: 'yeye', name: 'Yeye', color: '#3f6fb5', core: false, notes: '' },
      { id: 'popo', name: 'Popo', color: '#a14f9c', core: false, notes: '' },
      { id: 'gonggong', name: 'Gong Gong', color: '#3d8a8a', core: false, notes: '' },
      { id: 'didi1', name: 'Didi 1', color: '#8a6d3b', core: false, notes: '' },
      { id: 'didi2', name: 'Didi 2', color: '#7a7a2e', core: false, notes: '' },
      { id: 'lucy', name: 'Lucy', color: '#b5533c', core: false, notes: '' },
      { id: 'cats', name: 'Cats (5)', color: '#6b6b6b', core: false, notes: '' },
      { id: 'chico', name: 'Chico', color: '#9a6a2f', core: false, notes: '' },
      { id: 'ohio', name: 'Ohio', color: '#4a7a9a', core: false, notes: '' }
    ],
    routines: [
      {
        id: 'morning', name: 'Morning routine', people: ['me'], steps: [
          { id: 'm1', title: 'Wake up', min: 10, people: ['eloise'] },
          { id: 'm2', title: 'Change diaper', min: 5, people: ['anaise'] },
          { id: 'm3', title: 'Bathroom (toilet)', min: 5, people: ['eloise'] },
          { id: 'm4', title: 'Out to deck · Eloise + me brush teeth', min: 5, people: ['chayote', 'eloise'] },
          { id: 'm5', title: 'Wipe and dress', min: 5, people: ['eloise'] },
          { id: 'm6', title: 'Downstairs · Nainai feeds breakfast', min: 3, people: ['eloise', 'nainai'] },
          { id: 'm7', title: 'Brush teeth', min: 1, people: ['chayote'] },
          { id: 'm8', title: 'Vitamin D drop', min: 1, people: ['anaise'] },
          { id: 'm9', title: 'Change diaper (2nd)', min: 5, people: ['anaise'] },
          { id: 'm10', title: 'Grab diaper bag, phones, iPad, water', min: 5, people: [] },
          { id: 'm11', title: 'School prep · pack backpack, make sure Eloise eats', min: 15, people: ['eloise'], days: SCHOOL, list: 'backpack' },
          { id: 'm12', title: 'Get ready for school · walk Chayote · pack backpack', min: 20, people: ['eloise', 'chayote'], days: SCHOOL, list: 'backpack' }
        ]
      },
      {
        id: 'backschool', name: 'Back from school', people: ['me', 'eloise'], steps: [
          { id: 'b1', title: 'Upstairs', min: 2, people: [] },
          { id: 'b2', title: 'Bathroom', min: 5, people: [] },
          { id: 'b3', title: 'Wash hands', min: 3, people: [] },
          { id: 'b4', title: 'Nap (30–40m)', min: 40, people: [], mustEndBy: 1020 }
        ]
      },
      {
        id: 'napdown', name: 'Nap time', people: ['me', 'eloise'], steps: [
          { id: 'n1', title: 'Head upstairs', min: 15, people: [] },
          { id: 'n2', title: 'Nap (2–3h)', min: 150, people: [] }
        ]
      },
      {
        id: 'wakeup', name: 'Nap wake up', people: ['me'], steps: [
          { id: 'w1', title: 'Change diaper', min: 5, people: ['anaise'] },
          { id: 'w2', title: 'Change clothes', min: 5, people: ['anaise'], optional: true, skipWhen: 'poo' },
          { id: 'w3', title: 'Feed', min: 20, people: ['anaise'], optional: true },
          { id: 'w4', title: 'Bathroom', min: 5, people: ['eloise'] },
          { id: 'w5', title: 'Get dressed', min: 5, people: ['eloise'] },
          { id: 'w6', title: 'Grab diaper bag, phones, iPad, water', min: 5, people: [] },
          { id: 'w7', title: 'Walk Chayote', min: 20, people: ['chayote'] },
          { id: 'w8', title: 'Wash hands', min: 5, people: ['eloise'] },
          { id: 'w9', title: 'Dinner', min: 45, people: ['husband', 'eloise', 'anaise'] }
        ]
      },
      {
        id: 'night', name: 'Night routine', people: ['me', 'eloise'], steps: [
          { id: 'x1', title: 'Bathroom', min: 5, people: [] },
          { id: 'x2', title: 'Brush teeth', min: 5, people: [] },
          { id: 'x3', title: 'Shower', min: 20, people: [] },
          { id: 'x4', title: 'Lotion', min: 5, people: [] },
          { id: 'x5', title: 'Comb hair', min: 5, people: [] },
          { id: 'x6', title: 'Change diaper and clothes', min: 10, people: ['anaise'] },
          { id: 'x7', title: 'Lights off', min: 0, people: [] },
          { id: 'x8', title: 'Last video', min: 15, people: [] },
          { id: 'x9', title: 'Eloise bathroom', min: 5, people: [] },
          { id: 'x10', title: 'Sleep by 2100–2200', min: 0, people: [] }
        ]
      },
      {
        id: 'poo', name: 'Poo routine', people: ['me', 'anaise'], quick: true, tag: 'poo', steps: [
          { id: 'p1', title: 'Wash Anaise', min: 5, people: [] },
          { id: 'p2', title: 'Wash diaper', min: 5, people: [] },
          { id: 'p3', title: 'Lotion + cornstarch', min: 3, people: [] },
          { id: 'p4', title: 'New diaper + new clothes', min: 5, people: [] }
        ]
      }
    ],
    schedule: [
      { id: 's-morning', kind: 'routine', routineId: 'morning', start: 450, days: ALL },
      { id: 's-walkto', kind: 'event', title: 'Walk to school', start: 530, end: 540, days: SCHOOL, people: ['me', 'eloise'] },
      { id: 's-school', kind: 'event', title: 'Preschool', start: 540, end: 900, days: SCHOOL, people: ['eloise'] },
      { id: 's-walkback', kind: 'event', title: 'Walk home', start: 900, end: 915, days: SCHOOL, people: ['me', 'eloise'] },
      { id: 's-back', kind: 'routine', routineId: 'backschool', start: 915, days: SCHOOL },
      { id: 's-lunch', kind: 'event', title: 'Lunch', start: 690, end: 720, days: HOME, people: ['me', 'eloise', 'husband'] },
      { id: 's-nap', kind: 'routine', routineId: 'napdown', start: 765, days: HOME },
      { id: 's-wake', kind: 'routine', routineId: 'wakeup', start: 1020, days: ALL },
      { id: 's-night', kind: 'routine', routineId: 'night', start: 1155, days: ALL }
    ],
    tasks: [
      { id: 't-mail', title: 'Check mail', min: 5, freq: { type: 'daily' }, mode: 'float', assign: { type: 'person', people: ['me'] } }
    ],
    lists: [
      {
        id: 'backpack', name: 'Backpack', personId: 'eloise', days: SCHOOL, items: [
          { id: 'k1', title: 'AM snack', days: SCHOOL },
          { id: 'k2', title: 'Lunch', days: [2, 4], note: 'Wed is pizza day' },
          { id: 'k3', title: 'PM snack', days: SCHOOL },
          { id: 'k4', title: 'Water bottle', days: SCHOOL },
          { id: 'k5', title: 'Folder', days: SCHOOL },
          { id: 'k6', title: 'Blanket', days: [2] }
        ]
      },
      { id: 'diaperbag', name: 'Diaper bag', personId: 'anaise', days: ALL, items: [] }
    ],
    care: [],
    due: [
      { id: 'd1', title: 'Dentist', people: ['me'], everyMonths: 6, lastDone: null, notes: '' },
      { id: 'd2', title: 'Optometrist', people: ['me'], everyMonths: 12, lastDone: null, notes: '' },
      { id: 'd3', title: 'Psychiatrist', people: ['me'], everyMonths: 3, lastDone: null, notes: '' }
    ],
    watch: [],
    proton: { url: '', events: [], imported: null, titleMap: {}, assign: {} },
    days: {},
    settings: { contacts: '', lastBackup: null, feedEveryMin: 180 }
  };
}
