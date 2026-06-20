import { getHyperscalerConfiguration, SupportedHyperscalers, TotoMicroservice, TotoMicroserviceConfiguration } from 'totoms';
import { ControllerConfig } from "./Config";
import { GetMe } from './dlg/user/GetMe';
import { PostUsers } from './dlg/user/PostUsers';
import { PutMeCefrLevel } from './dlg/user/PutMeCefrLevel';
import { GetGrammarConcept } from './dlg/grammar/GetGrammarConcept';
import { GetGrammarConcepts } from './dlg/grammar/GetGrammarConcepts';
import { PostGrammarConcept } from './dlg/grammar/PostGrammarConcept';
import { PostGrammarConceptBatch } from './dlg/grammar/PostGrammarConceptBatch';
import { GetVocabularyItem } from './dlg/vocabulary/GetVocabularyItem';
import { GetVocabularyItems } from './dlg/vocabulary/GetVocabularyItems';
import { LookupVocabularyItems } from './dlg/vocabulary/LookupVocabularyItems';
import { PostVocabularyItem } from './dlg/vocabulary/PostVocabularyItem';
import { PostVocabularyItemBatch } from './dlg/vocabulary/PostVocabularyItemBatch';
import { GetGrammarIntroduction } from './dlg/modules/GetGrammarIntroduction';
import { GetModule } from './dlg/modules/GetModule';
import { GetModules } from './dlg/modules/GetModules';
import { PostModule } from './dlg/modules/PostModule';
import { GetExercise } from './dlg/exercises/GetExercise';
import { PostExercises } from './dlg/exercises/PostExercises';
import { PostExerciseMistakeExplanation } from './dlg/exercises/PostExerciseMistakeExplanation';
import { PostExerciseAnswerVerification } from './dlg/exercises/PostExerciseAnswerVerification';
import { GetMeProgress } from './dlg/user/GetMeProgress';
import { GetUserVocabularyProgress } from './dlg/progress/GetUserVocabularyProgress';
import { GetUserVocabularyProgressItem } from './dlg/progress/GetUserVocabularyProgressItem';
import { GetUserGrammarProgress } from './dlg/progress/GetUserGrammarProgress';
import { GetUserGrammarProgressItem } from './dlg/progress/GetUserGrammarProgressItem';
import { StartPracticeSession } from './dlg/practiceSessions/StartPracticeSession';
import { GetPracticeSession } from './dlg/practiceSessions/GetPracticeSession';
import { SubmitPracticeAnswer } from './dlg/practiceSessions/SubmitPracticeAnswer';
import { CompletePracticeSession } from './dlg/practiceSessions/CompletePracticeSession';
import { GetTestEligibility } from './dlg/moduleTests/GetTestEligibility';
import { StartModuleTest } from './dlg/moduleTests/StartModuleTest';
import { GetModuleTest } from './dlg/moduleTests/GetModuleTest';
import { SubmitTestAnswer } from './dlg/moduleTests/SubmitTestAnswer';
import { SubmitModuleTest } from './dlg/moduleTests/SubmitModuleTest';
import { GetTestReview } from './dlg/moduleTests/GetTestReview';
import { PostLevelTestBank } from './dlg/levelTestBanks/PostLevelTestBank';
import { PostLevelTestBankExercises } from './dlg/levelTestBanks/PostLevelTestBankExercises';
import { GetLevelTestBank } from './dlg/levelTestBanks/GetLevelTestBank';
import { GetLevelTestEligibility } from './dlg/levelTests/GetLevelTestEligibility';
import { StartLevelTest } from './dlg/levelTests/StartLevelTest';
import { GetLevelTest } from './dlg/levelTests/GetLevelTest';
import { SubmitLevelTestAnswer } from './dlg/levelTests/SubmitLevelTestAnswer';
import { SubmitLevelTest } from './dlg/levelTests/SubmitLevelTest';
import { GetLevelTestReview } from './dlg/levelTests/GetLevelTestReview';

const config: TotoMicroserviceConfiguration = {
    serviceName: "tome-ms-language",
    basePath: '/tomelang',
    environment: {
        hyperscaler: process.env.HYPERSCALER as SupportedHyperscalers || "aws",
        hyperscalerConfiguration: getHyperscalerConfiguration()
    },
    customConfiguration: ControllerConfig,
    apiConfiguration: {
        apiEndpoints: [
            { method: 'POST', path: '/users', delegate: PostUsers },
            { method: 'GET', path: '/me', delegate: GetMe },
            { method: 'PUT', path: '/me/cefrLevel', delegate: PutMeCefrLevel },

            { method: 'POST', path: '/exercises', delegate: PostExercises },
            { method: 'GET', path: '/exercises/:id', delegate: GetExercise },
            { method: 'POST', path: '/exercises/:exerciseId/explainMistake', delegate: PostExerciseMistakeExplanation },
            { method: 'POST', path: '/exercises/:exerciseId/verifyAnswer', delegate: PostExerciseAnswerVerification },

            { method: 'POST', path: '/modules', delegate: PostModule },
            { method: 'GET', path: '/modules/:id', delegate: GetModule },
            { method: 'GET', path: '/modules', delegate: GetModules },
            { method: 'GET', path: '/modules/:moduleId/grammarIntroduction', delegate: GetGrammarIntroduction },

            { method: 'POST', path: '/grammarConcepts', delegate: PostGrammarConcept },
            { method: 'POST', path: '/grammarConcepts/batch', delegate: PostGrammarConceptBatch },
            { method: 'GET', path: '/grammarConcepts/:id', delegate: GetGrammarConcept },
            { method: 'GET', path: '/grammarConcepts', delegate: GetGrammarConcepts },

            { method: 'POST', path: '/vocabularyItems', delegate: PostVocabularyItem },
            { method: 'POST', path: '/vocabularyItems/batch', delegate: PostVocabularyItemBatch },
            { method: 'POST', path: '/vocabularyItems/lookup', delegate: LookupVocabularyItems },
            { method: 'GET', path: '/vocabularyItems', delegate: GetVocabularyItems },
            { method: 'GET', path: '/vocabularyItems/:id', delegate: GetVocabularyItem },

            { method: 'GET', path: '/me/progress', delegate: GetMeProgress },

            { method: 'GET', path: '/users/:userId/vocabularyProgress', delegate: GetUserVocabularyProgress },
            { method: 'GET', path: '/users/:userId/vocabularyProgress/:vocabularyItemId', delegate: GetUserVocabularyProgressItem },

            { method: 'GET', path: '/users/:userId/grammarProgress', delegate: GetUserGrammarProgress },
            { method: 'GET', path: '/users/:userId/grammarProgress/:grammarConceptId', delegate: GetUserGrammarProgressItem },

            { method: 'POST', path: '/users/:userId/modules/:moduleId/practiceSessions', delegate: StartPracticeSession },
            { method: 'GET', path: '/users/:userId/practiceSessions/:sessionId', delegate: GetPracticeSession },
            { method: 'POST', path: '/users/:userId/practiceSessions/:sessionId/answers', delegate: SubmitPracticeAnswer },
            { method: 'POST', path: '/users/:userId/practiceSessions/:sessionId/complete', delegate: CompletePracticeSession },

            { method: 'GET', path: '/users/:userId/modules/:moduleId/testEligibility', delegate: GetTestEligibility },
            { method: 'POST', path: '/users/:userId/modules/:moduleId/tests', delegate: StartModuleTest },
            { method: 'GET', path: '/users/:userId/moduleTests/:attemptId', delegate: GetModuleTest },
            { method: 'POST', path: '/users/:userId/moduleTests/:attemptId/answers', delegate: SubmitTestAnswer },
            { method: 'POST', path: '/users/:userId/moduleTests/:attemptId/submit', delegate: SubmitModuleTest },
            { method: 'GET', path: '/users/:userId/moduleTests/:attemptId/review', delegate: GetTestReview },

            { method: 'POST', path: '/levelTestBanks', delegate: PostLevelTestBank },
            { method: 'POST', path: '/levelTestBanks/:cefrLevel/exercises', delegate: PostLevelTestBankExercises },
            { method: 'GET', path: '/levelTestBanks/:cefrLevel', delegate: GetLevelTestBank },

            { method: 'GET', path: '/users/:userId/levelTest/eligibility', delegate: GetLevelTestEligibility },
            { method: 'POST', path: '/users/:userId/levelTests', delegate: StartLevelTest },
            { method: 'GET', path: '/users/:userId/levelTests/:attemptId', delegate: GetLevelTest },
            { method: 'POST', path: '/users/:userId/levelTests/:attemptId/answers', delegate: SubmitLevelTestAnswer },
            { method: 'POST', path: '/users/:userId/levelTests/:attemptId/submit', delegate: SubmitLevelTest },
            { method: 'GET', path: '/users/:userId/levelTests/:attemptId/review', delegate: GetLevelTestReview },
        ],
        apiOptions: { noCorrelationId: true }
    },
};

TotoMicroservice.init(config).then(microservice => {
    microservice.start();
});

