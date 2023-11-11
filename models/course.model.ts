import mongoose, {Document, Model, Schema} from "mongoose";

interface IComment {
    user: object;
    comment: string;
    commentReplies?: IComment[]
    
}
interface IReview extends Document {
    user: object;
    course: string;
    rating: number;
    comment: IComment[];

}

interface ILink extends Document {
    name: string;
    url: string;
}

interface ICourseData extends Document {
    title: string;
    description: string;
    videoUrl: string;
    videoThumbnail: object;
    videoSection: string;
    videoLength: number;
    videoPlayer: string;
    links: ILink[];
    suggestions: string;
    questions: IComment[];

}

interface ICourse extends Document{
    name: string;
    description: string;
    price: number;
    estimatedPrice?: number;
    thumbnail: object;
    tags: string;
    level: string;
    demoUrl: string;
    benefit: {title: string, description: string}[];
    reviews: IReview[];
    courseData: ICourseData[];
    rating?: number;
    purchased?: boolean;
    prerequisites?: object[];


}

const reviewSchema = new Schema<IReview>({
    user: Object,
    rating: {
        type: Number,
        default: 0
    },
    comment: String
})

const linkSchema = new Schema<ILink>({
    name: String,
    url: String
})

const commentSchema = new Schema<IComment>({
    user: Object,
    comment: String,
    commentReplies: [Object],

})

const courseDataSchema = new Schema<ICourseData>({
    videoUrl : String,
    videoThumbnail: Object,
    title: String,
    videoSection: String,
    description: String,
    videoLength: Number,
    videoPlayer: String,
    links: [linkSchema],
    suggestions: String,
    questions: [commentSchema]
});

const courseSchema = new Schema<ICourse>({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    estimatedPrice: {
        type: Number,
    },
    thumbnail:{
        public_id:{
            type: String,
            required: true
        },
        url:{
            type: String,
            required: true
        }
    },
    tags: {
        type: String,
        required: true
    },
    level: {
        type: String,
        required: true
    },
    demoUrl: {
        type: String,
        required: true
    },
    benefit: [{title: String}],
    prerequisites: [{title: String}],
    reviews: [reviewSchema],
    courseData: [courseDataSchema],
    rating: {
        default: 0,
        type: Number
    },
    purchased: {
        default: 0,
        type: Number
    }
        
})

const CourseModel: Model<ICourse> = mongoose.model("Course", courseSchema);

export default CourseModel;
