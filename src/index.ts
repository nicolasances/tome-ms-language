import { getHyperscalerConfiguration, SupportedHyperscalers, TotoMicroservice, TotoMicroserviceConfiguration } from 'totoms';
import { ControllerConfig } from "./Config";
import { AddSentenceAlternative } from './dlg/AddSentenceAlternative';
import { AddWordAlternative } from './dlg/AddWordAlternative';
import { CompleteSession } from './dlg/session/CompleteSession';
import { DeleteWord } from './dlg/DeleteWord';
import { GetActiveSession } from './dlg/session/GetActiveSession';
import { GetRollingSessionStats } from './dlg/session/GetRollingSessionStats';
import { GetSentence } from './dlg/GetSentence';
import { GetSentences } from './dlg/GetSentences';
import { GetSentencesWithStats } from './dlg/GetSentencesWithStats';
import { GetVocabulary } from './dlg/GetVocabulary';
import { GetVocabularyWithStats } from './dlg/GetVocabularyWithStats';
import { GetWeeklySessionStats } from './dlg/session/GetWeeklySessionStats';
import { GetWord } from './dlg/GetWord';
import { PostSentence } from './dlg/PostSentence';
import { PostSentences } from './dlg/PostSentences';
import { PostWord } from './dlg/PostWord';
import { PostWords } from './dlg/PostWords';
import { PutWord } from './dlg/PutWord';
import { RemoveSentenceAlternative } from './dlg/RemoveSentenceAlternative';
import { RemoveWordAlternative } from './dlg/RemoveWordAlternative';
import { SampleWords } from './dlg/SampleWords';
import { StartSession } from './dlg/session/StartSession';
import { SubmitAnswer } from './dlg/session/SubmitAnswer';

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
            { method: 'GET', path: '/vocabulary/:language', delegate: GetVocabulary },
            { method: 'GET', path: '/vocabulary/:language/with-stats', delegate: GetVocabularyWithStats },
            { method: 'POST', path: '/vocabulary/:language/words', delegate: PostWord },
            { method: 'POST', path: '/vocabulary/:language/words/batch', delegate: PostWords },
            { method: 'GET', path: '/vocabulary/:language/words/sample', delegate: SampleWords },
            { method: 'GET', path: '/vocabulary/:language/words/:wordId', delegate: GetWord },
            { method: 'PUT', path: '/vocabulary/:language/words/:id', delegate: PutWord },
            { method: 'DELETE', path: '/vocabulary/:language/words/:id', delegate: DeleteWord },
            { method: 'POST', path: '/vocabulary/:language/words/:wordId/alternatives', delegate: AddWordAlternative },
            { method: 'DELETE', path: '/vocabulary/:language/words/:wordId/alternatives/:id', delegate: RemoveWordAlternative },
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
        ],
        apiOptions: { noCorrelationId: true }
    }, 
};

TotoMicroservice.init(config).then(microservice => {
    microservice.start();
});
