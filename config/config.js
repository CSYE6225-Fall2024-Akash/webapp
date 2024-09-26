require('dotenv').config(); 

const config = {
  db: {
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT, 
    dialect: 'mysql', 
    logging: false    
  },
  server: {
    port: process.env.PORT 
  }
};

module.exports = config;