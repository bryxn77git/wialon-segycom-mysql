const axios = require('axios');
const mysql = require('mysql');

// Configura los parámetros de conexión a la base de datos MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'wialon_segycom'
});

// Establece la conexión
connection.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    return;
  }
  console.log('Conexión exitosa a la base de datos!');
});

// Definir los parámetros de autenticación
// const token = '56fc2cd3bbbce202a994ff1dacb04e909A0BFC70A317DA0B56E8A1193F96FCD6FD81772B'; 
// const token = '39ea53443b16546825bec20a57c36dad6F59E2D993BF39A0FA558779C6C10AAFA4AA8782';
const token = 'b1b528b4b2ac829cb73d89c4c69c69504CDD023114467DD98A95EA1EAA6096C56364AB85';
const apiUrl = 'https://www.gpssegycom.com/wialon/ajax.html';

// Función para realizar la solicitud de inicio de sesión
async function login() {
  try {
    const response = await axios.get(apiUrl, {
      params: {
        svc: 'token/login',
        params: JSON.stringify({ token: token, fl:256 })
      }
    });
    const sid = response.data.eid; // Obtener el SID de la respuesta

    return sid;
  } catch (error) {
    console.error('Error al realizar el inicio de sesión:', error.message);
    throw error;
  }
}

// Función para obtener las unidades
async function getUnits(sid) {
  try {
    const response = await axios.get(apiUrl, {
      params: {
        svc: 'core/search_items',
        params: JSON.stringify({
          spec: {
            itemsType: 'avl_unit',
            propName: 'sys_name',
            propValueMask: '*',
            sortType: 'sys_name',
            propType: 'property',
          },
          force: 1,
          flags: 1,
          from: 0,
          to: 0,
        }),
        sid: sid,
      },
    });
    const units = response.data.items.map( unit => unit.id )
    // Obtener las unidades de la respuesta

    return units;

  } catch (error) {
    console.error('Error al obtener las unidades:', error.message);
    throw error;
  }
}

// Función para añadir unidades a la sesión
async function addUnitsToSession(sid, units) {
    console.log(units)
    console.log(sid)

  try {
    const response = await axios.get(apiUrl, {
      params: {
        svc: 'core/update_data_flags',
        params: JSON.stringify({
          spec: [{
              type: 'col',
              data: units,
              flags: "4611686018427387903",
              mode: 0
          }]
        }),
        sid: sid,
      },
    });
    // console.log(response)
    const result = response.data; // Obtener el resultado de la respuesta
    
    return result;
  } catch (error) {
    console.error('Error al añadir unidades a la sesión:', error.message);
    throw error;
  }
}

// Función para suscribirse a los eventos en tiempo real de las unidades
async function subscribeToEvents(sid) {
  try {
    const response = await axios.get(`https://www.gpssegycom.com/avl_evts?sid=${sid}`);

    const result = response.data; // Obtener el resultado de la respuesta

    return result;
  } catch (error) {
    console.error('Error al suscribirse a los eventos:', error.message);
    throw error;
  }
}

// Función para mostrar los eventos en consola
async function showEvents(events, sid) {
  
  if( events.events.length !== 0 ){
    events.events.map( async message => {

      if(message.t !== 'm'){
        return '';
      }

      if( message.d.tp !== 'ud'){
        return '';
      }

      const response = await axios.get(apiUrl, {
          params: {
            svc: 'core/search_item',
            params: JSON.stringify({
              id: message.i,
              flags: "4611686018427387903",
            }),
            sid: sid,
          },
        });

        const result = response.data.item; // Obtener el resultado de la respuesta

      // Extraer los datos necesarios del objeto result
      const data = {
        imei: result.uid,
        name: result.nm,
        lon: message.d.pos.x,
        lat: message.d.pos.y ,
        report_date: new Date(message.d.t * 1000),
      };

      console.log('Data:', data);

      // Insertar los datos en la base de datos
      const query = 'INSERT INTO reports SET ?';
      connection.query(query, data, (err, res) => {
        if (err) {
          console.error('Error al insertar datos:', err);
          return;
        }
        console.log('Datos insertados correctamente en la tabla reports!');
      });
    })

  }else {
    console.log('Eventos: {}');
  }
 
}

// Función principal asincrónica para ejecutar el flujo
async function main() {
  try {
    // Iniciar sesión y obtener el SID
    const sid = await login();
    console.log('SID:', sid);

    // Obtener las unidades
    const units = await getUnits(sid);
    console.log('Unidades:', units);

    // Añadir las unidades a la sesión
    const result = await addUnitsToSession(sid, units);
    // console.log('Resultado de añadir unidades:', result);

    // Suscribirse a los eventos de las unidades
    setInterval(async () => {
        const events = await subscribeToEvents(sid);
        // console.log('Suscripción a eventos exitosa');
        
        // Mostrar los eventos en tiempo real
        showEvents(events, sid);
    }, 3000);


  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Ejecutar la función principal
main();