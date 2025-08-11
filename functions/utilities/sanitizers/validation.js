const isEmail = (email) => {
    const regExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return regExp.test(email);
}

const isEmpty = (string) => string.trim() === '';

const validateSignupData = (data) => {
    try {
        let errors = {};

        if (isEmpty(data.email)) {
            errors.email = 'Must not be empty';
        } else if (!isEmail(data.email)) {
            errors.email = 'Must be a valid email address';
        }

        if (isEmpty(data.password)) errors.password = 'Must not be empty';
        if (data.confirmPassword !== data.confirmPassword) errors.confirmPassword = "Passwords must match";
        if (isEmpty(data.username)) errors.username = 'Must not be empty';
        if (isEmpty(data.type)) errors.type = 'Must not be empty';

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    } catch (error) {
        console.log(error);
    }

}

const validateLoginData = (data) => {
    try {
        let errors = {};

        if (isEmpty(data.email)) errors.email = 'Must not be empty';
        if (isEmpty(data.password)) errors.password = 'Must not be empty';

        return {
            errors,
            valid: Object.keys(errors).length === 0
        };
    } catch (error) {
        console.log(error);
    }
}

// const reduceUserDetails = (data) => {
//     let userDetails = {};

//     if (!isEmpty(data.bio)) userDetails.bio = data.bio.trim();
//     if (!isEmpty(data.location)) userDetails.location = data.location.trim();
//     if (!isEmpty(data.names)) userDetails.names = data.names.trim();
//     if (!isEmpty(data.lastname)) userDetails.lastname = data.lastname.trim();
//     // Si decides incluir validación de teléfono en el futuro, puedes hacerlo aquí.
//     userDetails.phone = data.phone;

//     return userDetails;
// };

const reduceSeller = (data) => {
    try {
        // Proporcionar un objeto vacío como valor por defecto si data es undefined
        data = data || {};
        let sellerDetails = {
            companyData: {
              
            } 
        };
        if (data.companyData) {
            if (!isEmpty(data.companyData.name.trim())) 
                sellerDetails.companyData.name = data.companyData.name;
            if (!isEmpty(data.companyData.standId.trim())) 
                sellerDetails.companyData.standId = data.companyData.standId;
        }
        console.log({sellerDetails});
        return sellerDetails;
    } catch (error) {
        console.log(error);
        return {};  // Considera devolver un objeto vacío o manejar el error de otra manera
    }
};


const validateCoordsData = (data) => {
    try {
        let coords = {};

        if (!isEmpty(data.coords)) coords.coords = data.coords;

        return coordsValidate;
    } catch (error) {
        console.log(error);
    }
};

export {
    validateSignupData,
    validateLoginData,
    reduceSeller,
    validateCoordsData
}


