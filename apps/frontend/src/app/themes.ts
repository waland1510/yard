
export interface Theme {
  name: string;
  characters: {
    culprit: {
      name: string;
      image: string;
    };
    detectives: {
      name: string;
      image: string;
    }[];
  };
  transportation: {
    taxi: string;
    bus: string;
    underground: string;
    secret: string;
    double: string;
    river: string;
  };
}

export const themes: Record<string, Theme> = {
  classic: {
    name: 'Classic',
    characters: {
      culprit: { name: 'Mr. X', image: '/images/culprit.png' },
      detectives: [
        { name: 'Detective 1', image: '/images/detective1.png' },
        { name: 'Detective 2', image: '/images/detective2.png' },
        { name: 'Detective 3', image: '/images/detective3.png' },
        { name: 'Detective 4', image: '/images/detective4.png' },
        { name: 'Detective 5', image: '/images/detective5.png' },
      ],
    },
    transportation: {
      taxi: 'Taxi',
      bus: 'Bus',
      underground: 'Underground',
      secret: 'Secret',
      double: 'Double',
      river: 'River',
    },
  },
  'harry-potter': {
    name: 'Harry Potter',
    characters: {
      culprit: { name: 'Bellatrix', image: '/images/harry-potter/bellatrix.png' },
      detectives: [
        { name: 'Harry', image: '/images/harry.png' },
        { name: 'Hermione', image: '/images/harry-potter/hermione.png' },
        { name: 'Ron', image: '/images/harry-potter/ron.png' },
        { name: 'Mad-Eye', image: '/images/harry-potter/mad-eye.png' },
        { name: 'Tonks', image: '/images/harry-potter/tonks.png' },
      ],
    },
    transportation: {
      taxi: 'Apparition',
      bus: 'Knight Bus',
      underground: 'Floo Network',
      secret: 'Invisibility Cloak',
      double: 'Time-Turner',
      river: 'Portkey',
    },
  },
};
