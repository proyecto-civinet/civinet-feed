require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const categorias = [
  { id: 1, categoria: 'Ayuda Social' },    // Mercado para mujeres
  { id: 2, categoria: 'Ayuda Social' },    // Voluntarios contra el hambre
  { id: 3, categoria: 'Educación' },       // Aldeas Infantiles
  { id: 4, categoria: 'Ayuda Social' },    // Ayuda en acción
  { id: 5, categoria: 'Medio Ambiente' },  // Humedales Bogotá
  { id: 6, categoria: 'Animales' },        // Fundación MIA
  { id: 7, categoria: 'Animales' },        // Refugio Milagrinos
  { id: 8, categoria: 'Educación' },       // Educación para Todos
  { id: 9, categoria: 'Ayuda Social' },    // Cruz Roja
  { id: 10, categoria: 'Deporte' },        // Juventud Activa
];

async function agregarCategorias() {
  for (const item of categorias) {
    const { error } = await supabase
      .from('publicaciones')
      .update({ categoria: item.categoria })
      .eq('id', item.id);

    if (error) {
      console.error(`❌ Error en id ${item.id}:`, error.message);
    } else {
      console.log(`✅ id ${item.id} actualizado - ${item.categoria}`);
    }
  }
  console.log('¡Listo!');
}

agregarCategorias();