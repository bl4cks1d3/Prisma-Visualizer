
import { v4 as uuidv4 } from 'uuid';

const NAMES = ['Alice Silva', 'Bruno Souza', 'Carla Oliveira', 'Daniel Santos', 'Eduarda Lima', 'Felipe Costa', 'Gabriela Rocha', 'Henrique Pereira'];
const CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Salvador', 'Fortaleza', 'Brasília'];
const LERO_LERO = [
  'O empenho em analisar a consolidação das estruturas oferece uma interessante oportunidade para verificação do remanejamento dos quadros funcionais.',
  'O cuidado em identificar pontos críticos na execução dos pontos de programa apresenta tendências no sentido de aprovar a manutenção das formas de ação.',
  'A nível organizacional, a mobilidade dos capitais internacionais estende o alcance e a importância das condições financeiras e administrativas exigidas.',
  'Nunca é demais lembrar o peso e o significado destes problemas, uma vez que o fenômeno da Internet facilita a criação do sistema de formação de quadros que corresponde às necessidades.',
  'Podemos já vislumbrar o modo pelo qual a complexidade dos estudos efetuados auxilia a preparação e a estruturação das diretrizes de desenvolvimento para o futuro.'
];

export const generateMockValue = (type: string, fieldName: string) => {
  const nameLower = fieldName.toLowerCase();
  
  if (nameLower.includes('id') && (type === 'String' || type === 'Int')) {
    return type === 'Int' ? Math.floor(Math.random() * 10000) : uuidv4();
  }
  
  if (nameLower.includes('email')) {
    return `${uuidv4().slice(0, 8)}@example.com`;
  }
  
  if (nameLower.includes('name')) {
    return NAMES[Math.floor(Math.random() * NAMES.length)];
  }
  
  if (nameLower.includes('city') || nameLower.includes('address')) {
    return CITIES[Math.floor(Math.random() * CITIES.length)];
  }
  
  if (nameLower.includes('password') || nameLower.includes('hash')) {
    return '$2b$10$n94.P9Wv7.21p.E.7.21p.E.7.21p.E.7.21p.E.7.21p.E.';
  }

  if (nameLower.includes('uuid')) {
    return uuidv4();
  }

  if (nameLower.includes('phone')) {
    return `+55 (11) 9${Math.floor(10000000 + Math.random() * 90000000)}`;
  }
  
  if (type === 'String') {
    return LERO_LERO[Math.floor(Math.random() * LERO_LERO.length)];
  }
  
  if (type === 'Int' || type === 'Float' || type === 'Decimal') {
    return Math.floor(Math.random() * 100);
  }
  
  if (type === 'Boolean') {
    return Math.random() > 0.5;
  }
  
  if (type === 'DateTime') {
    return new Date().toISOString();
  }
  
  return '';
};
