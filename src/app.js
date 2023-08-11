import express from "express";
import { v4 as uuid } from "uuid";
import cors from "cors";
import Joi from "joi";
import dayjs from "dayjs";
import bcrypt from "bcrypt"
import { db } from "./database/database.connection.js";

const app = express();
app.use(cors());
app.use(express.json());



const createUser = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

const loginUser = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

const createService = Joi.object({
    creator: Joi.string().required(),
    serviceName: Joi.string().required(),
    serviceDescription: Joi.string().required(),
    serviceCategory: Joi.string().required(),
    servicePrice: Joi.string().required(),
    serviceDeadline: Joi.string().required(),
    creatorEmail: Joi.string().email().required(),
});

/// adicionar para o usuario uma coluna de avaliação

let token;

const createdAt = dayjs().format('YYYY-MM-DD HH:mm:ss');

app.post('/signup', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body

    console.log('SUCCESS ON ENTERING')

    try {

        const validation = createUser.validate({ name, email, password }, { abortEarly: false });
        if (validation.error) {
            const errors = validation.error.details.map((detail) => detail.message);
            return res.status(422).json(errors);
        }

        if (password !== confirmPassword) {
            return res.status(422).send('Password and confirmPassword must match.');
        }

        // Encriptação da senha
        const passCrypt = bcrypt.hashSync(password, 10);

        const userVerify = await db.query('SELECT * FROM USERS where email = $1', [email]);
        if (userVerify.rows.length > 0) {
            return res.status(409).send('There is an user already with this email!');
        } else {
            const user = await db.query('INSERT INTO USERS (name, email, password, "createdat") values ($1, $2, $3, $4);', [name, email, passCrypt, createdAt]);
            console.log('USER CREATED!')
            return res.status(201).send('User created!');
        }
    } catch (err) {
        return res.status(500).send(err.message);
    }

})

app.post("/login", async (req, res) => {
    const { email, password } = req.body

    console.log("entrou - login")

    const validation = loginUser.validate({ email, password }, { abortEarly: "False" })
    if (validation.error) {
        console.log("error 1")
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors);
    }

    const users = await db.query('SELECT * FROM USERS WHERE EMAIL = $1;', [email])
    if (users.rows.length < 1) {
        console.log("error 2 - user not found!")
        return res.status(404).send("There is no user with this email registered.");
    }

    const unHash = bcrypt.compareSync(password, users.rows[0].password)



    if (unHash === false) {
        console.log("erro 3 - wrong password")
        return res.status(401).send("Wrong Password")
    }

    token = uuid()


    const profileData = {
        name: users.rows[0].name,
        email: users.rows[0].email,
        token,
    }



    console.log("login success!")

    res.status(200).send(profileData) ///aqui deve retornar um token e o usuário tem de ser redirecionado para a rota /home

    ///utilize localstorage para manter o usuário logado
})

app.post("/services", async (req, res) => {
    
    const { creator, creatorEmail, serviceName, serviceCategory, serviceDeadline, serviceDescription, servicePrice, token } = req.body
    console.log("entrou - services")

    if (!token) {
        return res.status(403).send('ERROR UNAUTHORIZED: TOKEN IS REQUIRED!')
    }

    if (isNaN(serviceDeadline)) {
        return res.status(400).send('DEADLINE NEEDS TO BE AN INTEGER. EX: 1, 2, 3, 4, 5...');
    }
    
    if (isNaN(servicePrice)) {
        return res.status(400).send('PRICE NEEDS TO BE A NUMERIC. EX: 45.00 | 32.45');
    }
    

    const validation = createService.validate({ creator, creatorEmail, serviceName, serviceCategory, serviceDeadline, serviceDescription, servicePrice }, { abortEarly: "False" })
    if (validation.error) {
        console.log("error 1 - services")
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors);
    }

    const users = await db.query('SELECT * FROM USERS WHERE EMAIL = $1;', [creatorEmail])
    if (users.rows.length < 1) {
        console.log("error 2 - user not found!")
        return res.status(404).send("You need to sign-in in order to create a service. Use command 'login' to sign-in or 'signup' to create an account.");
    }

    try {
        const isActive = true;
        const services = await db.query('INSERT INTO SERVICES (creator ,serviceName, serviceDescription, category, price, createdAt, isActive, creatorEmail, deadline) values ($1, $2, $3, $4, $5, $6, $7, $8, $9);', [creator, serviceName, serviceDescription, serviceCategory, servicePrice, createdAt, isActive, creatorEmail, serviceDeadline]);
        console.log('SERVICE CREATED!')
        return res.status(201).send('Service created!');
    
    } catch (err) {
        return res.status(500).send(err.message);
        
    }
})




const port = process.env.PORT || 5000
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`)
})

