export type Photo = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

// Photos of the Spencer home. Files live in public/photos (webp, max 1600px wide).
export const housePhotos: Photo[] = [
  {
    src: "/photos/living-room.webp",
    alt: "Living room with couches, a television, and a dining table beside a wood accent wall",
    width: 1600,
    height: 1205,
  },
  {
    src: "/photos/bedroom-1.webp",
    alt: "Furnished bedroom with two beds, a shared dresser, and a full-length mirror",
    width: 1600,
    height: 1205,
  },
  {
    src: "/photos/community-room.webp",
    alt: "Community room with bar-height seating, a projector screen, and a study desk",
    width: 1600,
    height: 1205,
  },
  {
    src: "/photos/lounge.webp",
    alt: "Lounge with a sectional couch, bookshelf, and a desk for schoolwork or job searching",
    width: 1600,
    height: 1205,
  },
  {
    src: "/photos/bedroom-2.webp",
    alt: "Furnished bedroom with two twin beds, a dresser, and a large mirror",
    width: 1600,
    height: 1205,
  },
  {
    src: "/photos/bathroom.webp",
    alt: "Full bathroom with a tub and shower, toilet, and vanity",
    width: 1600,
    height: 2125,
  },
  {
    src: "/photos/back-deck.webp",
    alt: "Back deck with patio seating and string lights in the evening",
    width: 1600,
    height: 1205,
  },
];

export const featuredPhotos: Photo[] = [
  housePhotos[0],
  housePhotos[1],
  housePhotos[6],
];
