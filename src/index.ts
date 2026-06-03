import { getHyperscalerConfiguration, SupportedHyperscalers, TotoMicroservice, TotoMicroserviceConfiguration } from 'totoms';
import { ControllerConfig } from "./Config";
import { GetMe } from './dlg/GetMe';
import { PostUsers } from './dlg/PostUsers';
import { PutMeCefrLevel } from './dlg/PutMeCefrLevel';
import { AddSentenceAlternative } from './dlg/AddSentenceAlternative';
import { GetGrammarConcept } from './dlg/GetGrammarConcept';
import { GetGrammarConcepts } from './dlg/GetGrammarConcepts';
import { LookupGrammarConcepts } from './dlg/LookupGrammarConcepts';
import { PostGrammarConcept } from './dlg/PostGrammarConcept';
import { PostGrammarConceptBatch } from './dlg/PostGrammarConceptBatch';
import { CompleteSession } from './dlg/session/CompleteSession';
import { GetActiveSession } from './dlg/session/GetActiveSession';
import { GetRollingSessionStats } from './dlg/session/GetRollingSessionStats';
import { GetSentence } from './dlg/GetSentence';
import { GetSentences } from './dlg/GetSentences';
import { GetSentencesWithStats } from './dlg/GetSentencesWithStats';
import { GetVocabularyItem } from './dlg/GetVocabularyItem';
import { GetVocabularyItems } from './dlg/GetVocabularyItems';
import { GetWeeklySessionStats } from './dlg/session/GetWeeklySessionStats';
import { LookupVocabularyItems } from './dlg/LookupVocabularyItems';
import { PostSentence } from './dlg/PostSentence';
import { PostSentences } from './dlg/PostSentences';
import { PostVocabularyItem } from './dlg/PostVocabularyItem';
import { PostVocabularyItemBatch } from './dlg/PostVocabularyItemBatch';
import { GetModule } from './dlg/GetModule';
import { GetModules } from './dlg/GetModules';
import { PostModule } from './dlg/PostModule';
import { AppendExercisesToBank } from './dlg/AppendExercisesToBank';
import { GetExercise } from './dlg/GetExercise';
import { GetExercises } from './dlg/GetExercises';
import { PatchExerciseTimesShown } from './dlg/PatchExerciseTimesShown';
import { PatchExerciseUserContributedAnswers } from './dlg/PatchExerciseUserContributedAnswers';
import { GetExerciseBank } from './dlg/GetExerciseBank';
import { PostExerciseBank } from './dlg/PostExerciseBank';
import { RemoveSentenceAlternative } from './dlg/RemoveSentenceAlternative';
import { StartSession } from './dlg/session/StartSession';
import { SubmitAnswer } from './dlg/session/SubmitAnswer';
import { GetMeProgress } from './dlg/GetMeProgress';
import { PutMeModuleProgress } from './dlg/PutMeModuleProgress';
import { GetMeLevelProgress } from './dlg/GetMeLevelProgress';
import { PostMeModuleTestAttempt } from './dlg/PostMeModuleTestAttempt';

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

            { method: 'POST', path: '/exerciseBanks', delegate: PostExerciseBank },
            { method: 'GET', path: '/exerciseBanks/:moduleId', delegate: GetExerciseBank },
            { method: 'POST', path: '/exerciseBanks/:moduleId/exercises', delegate: AppendExercisesToBank },

            { method: 'GET', path: '/exercises', delegate: GetExercises },
            { method: 'GET', path: '/exercises/:id', delegate: GetExercise },
            { method: 'PUT', path: '/exercises/:id/timesShown', delegate: PatchExerciseTimesShown },
            { method: 'PUT', path: '/exercises/:id/userContributedAnswers', delegate: PatchExerciseUserContributedAnswers },

            { method: 'POST', path: '/modules', delegate: PostModule },
            { method: 'GET', path: '/modules/:id', delegate: GetModule },
            { method: 'GET', path: '/modules', delegate: GetModules },

            { method: 'POST', path: '/grammarConcepts', delegate: PostGrammarConcept },
            { method: 'POST', path: '/grammarConcepts/batch', delegate: PostGrammarConceptBatch },
            { method: 'GET', path: '/grammarConcepts/:id', delegate: GetGrammarConcept },
            { method: 'GET', path: '/grammarConcepts', delegate: GetGrammarConcepts },
            { method: 'POST', path: '/grammarConcepts/lookup', delegate: LookupGrammarConcepts },
            
            { method: 'POST', path: '/vocabularyItems', delegate: PostVocabularyItem },
            { method: 'POST', path: '/vocabularyItems/batch', delegate: PostVocabularyItemBatch },
            { method: 'POST', path: '/vocabularyItems/lookup', delegate: LookupVocabularyItems },
            { method: 'GET', path: '/vocabularyItems', delegate: GetVocabularyItems },
            { method: 'GET', path: '/vocabularyItems/:id', delegate: GetVocabularyItem },
            
            { method: 'GET', path: '/sentences/:language', delegate: GetSentences },
            { method: 'GET', path: '/sentences/:language/with-stats', delegate: GetSentencesWithStats },
            { method: 'POST', path: '/sentences/:language', delegate: PostSentence },
            { method: 'POST', path: '/sentences/:language/batch', delegate: PostSentences },
            { method: 'GET', path: '/sentences/:language/:sentenceId', delegate: GetSentence },
            { method: 'POST', path: '/sentences/:language/:sentenceId/alternatives', delegate: AddSentenceAlternative },
            { method: 'DELETE', path: '/sentences/:language/:sentenceId/alternatives/:id', delegate: RemoveSentenceAlternative },
            { method: 'POST', path: '/languages/:language/sessions', delegate: StartSession },
            { method: 'GET', path: '/sessions/active', delegate: GetActiveSession },
            { method: 'GET', path: '/sessions/stats/weekly', delegate: GetWeeklySessionStats },
            { method: 'GET', path: '/sessions/stats/rolling', delegate: GetRollingSessionStats },
            { method: 'POST', path: '/sessions/:sessionId/answers', delegate: SubmitAnswer },
            { method: 'POST', path: '/sessions/:sessionId/completion', delegate: CompleteSession },

            { method: 'GET', path: '/me/progress', delegate: GetMeProgress },
            { method: 'PUT', path: '/me/moduleProgress/:moduleId', delegate: PutMeModuleProgress },
            { method: 'GET', path: '/me/levelProgress', delegate: GetMeLevelProgress },
            { method: 'POST', path: '/me/moduleProgress/:moduleId/testAttempts', delegate: PostMeModuleTestAttempt },
        ],
        apiOptions: { noCorrelationId: true }
    },
};

TotoMicroservice.init(config).then(microservice => {
    microservice.start();
});
