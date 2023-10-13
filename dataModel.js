const showRooms = [
    {
        showroomId:"",
        createdAt:Date(),
        about:{
            name:"",
            dates:[],
            place:"",
            description:"",
            imgUrl:"", 
        },
        taxonomy:{
            
        },
        coords:{
            lat:0,
            lng:0,
            hash:"",
            nameOfPoint:""
        },
    }
]

const users = [
    {
        userId:"",
        createdAt:Date(),
        type:"buyer" || "seller",
        name:"",
        lastname:"",
        username:"",
        email:"",
        imgUrl:"",
    }
]

const sellers = [
    {
        sellerId:"",
        createdAt:Date(),
        admin:{
            username:"",
            userId:""
        },
        coords:{
            lat:0,
            lng:0,
            hash:"",
            nameOfPoint:""
        },
        companyData:{
            name:"",
            imgUrl:"",
            standId:"",
            pic360Url:""
        }
    }
]

const products = [
    {
        productId:"",
        createdAt:Date(),
        price:0,
        description:"",
        coords:{
            lat:0,
            lng:0,
            hash:"",
            nameOfPoint:""
        },
        sellerIdOwner,
        pics:[],
        taxonomy:{

        },
        tags:[],
        categories:[],
    }
]

const buyers = [
    {   
        buyerId:"",
        // admin user
        admin:{
            username:"",
            userId:""
        },
        createdAt:Date(),
        // live
        liveCoords:{
            lat:0,
            lng:0,
            hash:"",
            nameOfPoint:""
        },
        liveFeed:{ // colors???????
            matchQuality:0,
            matrixDistance:0
        },
        // queries
        docsQueriesIds:[],
        onDocQueryId:"",
        docIdSelectedOfProductsSuggestions:"",
        
        
    }  
]

const productSuggestions = [
    {
        productId:"",
        createdAt:Date(),
    }
]

const queries = [
    {
        queryId:"",
        createdAt:Date(),
        string:"",
        audioFileUrl:"",
        keyWords:[],
        admin:{
            username:"",
            userId:""
        },
        coords:{
            lat:0,
            lng:0,
            hash:"",
            nameOfPoint:""
        },
    }
]