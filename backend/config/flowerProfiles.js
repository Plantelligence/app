export const flowerProfiles = [
  {
    id: 'rosas',
    name: 'Rosas híbridas',
    summary: 'Cultivo voltado para corte com foco em botões longos e coloração intensa.',
    temperature: { min: 18, max: 25 },
    humidity: { min: 55, max: 70 },
    soilMoisture: { min: 45, max: 60 }
  },
  {
    id: 'tulipas',
    name: 'Tulipas',
    summary: 'Ambiente controlado para bulbos holandeses com ciclo forçado.',
    temperature: { min: 12, max: 18 },
    humidity: { min: 50, max: 65 },
    soilMoisture: { min: 40, max: 55 }
  },
  {
    id: 'orquideas',
    name: 'Orquídeas Phalaenopsis',
    summary: 'Estufa sombreada com nebulização periódica e raízes aéreas.',
    temperature: { min: 20, max: 28 },
    humidity: { min: 60, max: 85 },
    soilMoisture: { min: 35, max: 50 }
  },
  {
    id: 'gerberas',
    name: 'Gérberas',
    summary: 'Produção contínua para floricultura com ventoinhas moduladas.',
    temperature: { min: 16, max: 24 },
    humidity: { min: 50, max: 65 },
    soilMoisture: { min: 45, max: 58 }
  },
  {
    id: 'lilios',
    name: 'Lírios orientais',
    summary: 'Ambiente com fotoperíodo estendido e baixa umidade no substrato.',
    temperature: { min: 14, max: 22 },
    humidity: { min: 45, max: 60 },
    soilMoisture: { min: 30, max: 45 }
  }
];

export const findFlowerProfile = (profileId) =>
  flowerProfiles.find((profile) => profile.id === profileId) ?? null;

export const isValidFlowerProfile = (profileId) => Boolean(findFlowerProfile(profileId));
