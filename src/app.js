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


const buyService = Joi.object({
    buyer: Joi.string().required(),
    seller: Joi.string().required(),
    serviceId: Joi.number().integer().required(),
    serviceQtd: Joi.number().integer().required(),
    transactionPrice: Joi.number().required(),
});



/// adicionar para o usuario uma coluna de avaliação

let token;

const createdAt = dayjs().format('YYYY-MM-DD HH:mm:ss');

app.post('/signup', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body
    const lowerCaseemail = email.toLowerCase();

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
            const user = await db.query('INSERT INTO USERS (name, email, password, "createdat") values ($1, $2, $3, $4);', [name, lowerCaseemail, passCrypt, createdAt]);
            console.log('USER CREATED!')
            return res.status(201).send('User created!');
        }
    } catch (err) {
        return res.status(500).send(err.message);
    }

})

app.post("/login", async (req, res) => {
    const { email, password } = req.body
    const lowerCaseemail = email.toLowerCase();

    console.log("entrou - login")

    const validation = loginUser.validate({ email, password }, { abortEarly: "False" })
    if (validation.error) {
        console.log("error 1")
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors);
    }

    const users = await db.query('SELECT * FROM USERS WHERE EMAIL = $1;', [lowerCaseemail])
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
        earnings: users.rows[0].earnings,
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

app.get("/services", async (req, res) => {


    try {
        const services = await db.query('SELECT * FROM SERVICES WHERE isActive = $1', [true])
        return res.status(200).send(services.rows)
    } catch (err) {
        return res.status(500).send(err.message)

    }

})

app.get("/services/:creatorEmail", async (req, res) => {

    const { creatorEmail } = req.params


    try {
        const services = await db.query('SELECT * FROM SERVICES WHERE creatorEmail = $1', [creatorEmail])
        return res.status(200).send(services.rows)
    } catch (err) {
        return res.status(500).send(err.message)

    }

})

app.get("/services/user/:creator", async (req, res) => {

    const { creator } = req.params

    console.log('entrou creator')


    try {
        const services = await db.query('SELECT * FROM SERVICES WHERE creator = $1', [creator])
        if (services.rows < 1) {
            const userExists = await db.query('SELECT * FROM USERS WHERE name = $1;', [creator])
            if (userExists.rows < 1) {
                return res.status(404).send([`USER ${creator} DOES NOT EXISTS!`]);

            } else {
                return res.status(200).send(['USER DOES NOT HAVE ANY SERVICES'])
            }
        } else {
            return res.status(200).send(services.rows)
        }
    } catch (err) {
        return res.status(500).send(err.message)

    }

})

app.post("/services/buy/:serviceId", async (req, res) => {

    ///seller creator - services
    /// transactionPrice - serviceQtd * servicePrice
    const { serviceId } = req.params
    const { buyer, serviceQtd, token } = req.body
    console.log("entrou - buy")



    const services = await db.query('SELECT * FROM SERVICES WHERE id = $1 and isActive = $2;', [serviceId, true])
    if (services.rows.length < 1) {
        console.log("SERVICE NOT FOUND")
        console.log("erro 5 - buy")
        return res.status(404).send("SERVICE WITH ID " + serviceId + " NOT FOUND!");
    }

    const transactionPrice = serviceQtd * services.rows[0].price
    const seller = services.rows[0].creator

    if (!token) {
        console.log("erro 1 - buy")
        return res.status(403).send('ERROR UNAUTHORIZED: TOKEN IS REQUIRED!')
    }

    if (isNaN(serviceQtd)) {
        console.log("erro 2 - buy")
        return res.status(400).send('SERVICEQTD NEEDS TO BE AN INTEGER. EX: 1, 2, 3, 4, 5...');
    }



    const validation = buyService.validate({ buyer, seller, serviceId, serviceQtd, transactionPrice, }, { abortEarly: "False" })
    if (validation.error) {
        console.log("error 4 - buy service")
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors);
    }



    try {
        const transactionStatus = 'In progress'
        const services = await db.query('INSERT INTO TRANSACTIONS (buyer, seller, serviceId, serviceQtd, transactionPrice, transactionStatus, token, createdAt) values ($1, $2, $3, $4, $5, $6, $7, $8);', [buyer, seller, serviceId, serviceQtd, transactionPrice, transactionStatus, token, createdAt]);
        console.log('TRANSACTION COMPLETED!')
        return res.status(201).send('TRANSACTION COMPLETED!');

    } catch (err) {
        console.log("erro 6 - buy")
        return res.status(500).send(err.message);

    }

})

app.post("/services/deliver/:serviceId", async (req, res) => {

    const { serviceId } = req.params

    try {
        const verifyId = await db.query('SELECT * FROM TRANSACTIONS WHERE serviceId = $1 and transactionStatus = $2;', [serviceId, 'In progress'])
        if (verifyId.rows.length < 1) {
            return res.status(404).send('THERE IS NO SERVICE TO DELIVER WITH THIS ID.')
        }

        console.log(verifyId.rows[0].transactionprice)

        console.log(verifyId.rows[0].seller)
        const seller = verifyId.rows[0].seller
        const prevEarnings = await db.query('SELECT * FROM USERS WHERE name = $1;', [verifyId.rows[0].seller])

        const income = Number(verifyId.rows[0].transactionprice + prevEarnings.rows[0].earnings)
        console.log(income)
        const transaction = await db.query('UPDATE TRANSACTIONS SET transactionStatus = $1 where serviceId = $2;', ['Delivered', serviceId])
        await db.query('UPDATE USERS SET earnings = $1 where name = $2;', [income, seller])
        return res.status(200).send('SERVICE DELIVERED!')
    } catch (error) {
        return res.status(500).send(error.message)

    }

})

app.post("/services/cancel/:serviceId", async (req, res) => {

    const { serviceId } = req.params

    const {buyer} = req.body

    try {
        const verifyId = await db.query('SELECT * FROM TRANSACTIONS WHERE serviceId = $1 and transactionStatus = $2 and buyer = $3;', [serviceId, 'In progress', buyer])
        if (verifyId.rows.length < 1) {
            return res.status(404).send('THERE IS NO SERVICE TO DELIVER WITH THIS ID.')
        }

        console.log(verifyId.rows[0].transactionprice)

        console.log(verifyId.rows[0].seller)
        const seller = verifyId.rows[0].seller
        const prevEarnings = await db.query('SELECT * FROM USERS WHERE name = $1;', [verifyId.rows[0].seller])

        const income = Number(prevEarnings.rows[0].earnings - verifyId.rows[0].transactionprice)
        console.log(income)
        const transaction = await db.query('UPDATE TRANSACTIONS SET transactionStatus = $1 where serviceId = $2;', ['Canceled', serviceId])
        await db.query('UPDATE USERS SET earnings = $1 where name = $2;', [income, seller])
        return res.status(200).send('SERVICE CANCELED!')
    } catch (error) {
        return res.status(500).send(error.message)

    }

})

app.post("/services/deactivate/:serviceId", async (req, res) => {
    const { serviceId } = req.params;
    const { creatorEmail } = req.body;

    console.log(creatorEmail, serviceId);

    try {
        const service = await db.query("SELECT * FROM SERVICES WHERE ID = $1 AND isActive = $2 AND creatorEmail = $3;", [serviceId, true, creatorEmail]);

        console.log(service.rows);

        if (service.rows.length > 0) {
            try {
                await db.query("UPDATE SERVICES SET isActive = $1 where ID = $2;", [false, serviceId]);
                return res.status(200).send('SERVICE DEACTIVATED!');
            } catch (err) {
                return res.status(500).send(err.message);
            }
        } else {
            return res.status(404).send('THERE IS NO ACTIVE SERVICE WITH THIS ID BELONGING TO YOU.');
        }
    } catch (error) {
        return res.status(500).send(error.message);
    }
});


app.post("/services/activate/:serviceId", async (req, res) => {
    const { serviceId } = req.params;
    const { creatorEmail } = req.body;

    const service = await db.query("SELECT * FROM SERVICES WHERE ID = $1 AND isActive = $2 AND creatorEmail = $3;", [serviceId, false, creatorEmail]);
    if (service.rows.length > 0) {
        try {
            await db.query("UPDATE SERVICES SET isActive = $1 where ID = $2;", [true, serviceId]);
            return res.status(200).send('SERVICE ACTIVATED!');
        } catch (err) {
            return res.status(500).send(err.message);
        }
    } else {
        return res.status(404).send('THERE IS NO INACTIVE SERVICE WITH THIS ID BELONGING TO YOU.');
    }
});

app.get("/services/transactions/:name", async (req, res) => {
    console.log('ENTROU NO ME')

    const {name} = req.params

    try {
        const transactions = await db.query('SELECT * FROM TRANSACTIONS WHERE buyer = $1;', [name])
        console.log('ENTROU try')
        console.log(transactions.rows)
        return res.status(200).send(transactions.rows)
    } catch (err) {
        return res.status(500).send(err.message)

    }

})




const port = process.env.PORT || 5000
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`)
})


