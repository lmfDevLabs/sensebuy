// db
const { 
    auth,
    db,  
    storage,
} = require('../../firebase/admin')

const {
    storageBucket
} = require('../../firebase/firebaseConfig')

// validate datas
const { 
    validateSignupData, 
    validateLoginData,  
    // reduceUserDetails 
} = require('../../utilities/validation');

const BASE_STORAGE_URL = 'https://firebasestorage.googleapis.com/v0/b';

// sign up
exports.signup = async (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        type: req.body.type,
        confirmPassword: req.body.confirmPassword,
        username: req.body.username
    };

    // Validación de datos
    const { valid, errors } = validateSignupData(newUser);
    if (!valid) return res.status(400).json(errors);

    const noImg = 'no-img.png';

    try {
        const doc = await db.doc(`/users/${newUser.username}`).get();
        
        if (doc.exists) {
            return res.status(400).json({ username: 'this handle is already taken' });
        }

        const data = await auth.createUserWithEmailAndPassword(newUser.email, newUser.password);
        
        const token = await data.user.getIdToken();
        
        const userCredentials = {
            username: newUser.username,
            email: newUser.email,
            type: newUser.type,
            createdAt: new Date().toISOString(),
            imgUrl: `${BASE_STORAGE_URL}/${storageBucket}/o/${noImg}?alt=media`,
            userId: data.user.uid
        };
        
        await db.doc(`/users/${newUser.username}`).set(userCredentials);
        
        return res.status(201).json({ token });
    } catch (err) {
        console.error(err);
        
        if (err.code === 'auth/email-already-in-use') {
            return res.status(400).json({ email: 'Email is already in use' });
        }
        return res.status(500).json({ general: 'Something went wrong, please try again' });
    }
};

// login
exports.login = async (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    // Validación de datos
    const { valid, errors } = validateLoginData(user);
    if (!valid) return res.status(400).json(errors);

    try {
        const data = await auth.signInWithEmailAndPassword(user.email, user.password);
        const token = await data.user.getIdToken();
        return res.json({ token });
    } catch (err) {
        console.error(err);
        switch (err.code) {
            case 'auth/wrong-password':
                return res.status(401).json({ general: 'Incorrect password' });
            case 'auth/user-not-found':
                return res.status(401).json({ general: 'User not found' });
            default:
                return res.status(500).json({ general: 'Something went wrong, please try again' });
        }
    }
};
