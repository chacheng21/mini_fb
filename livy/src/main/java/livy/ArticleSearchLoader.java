package livy;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.services.dynamodbv2.model.WriteRequest;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import opennlp.tools.stemmer.PorterStemmer;
import opennlp.tools.stemmer.Stemmer;
import opennlp.tools.tokenize.SimpleTokenizer;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;
import storage.DynamoConnector;
import config.Config;

public class ArticleSearchLoader {
    final static String TABLE_NAME = "ArticleKeywords";
	int row = 0;
	
	SimpleTokenizer model;
	Stemmer stemmer;
	DynamoDB db;
	
    int rejected = 0;
    public static void main(String[] args) {
        try {
			ArticleSearchLoader loader = new ArticleSearchLoader();
		} catch (Exception e) {
			e.printStackTrace();
		} 
    }

	public ArticleSearchLoader() throws DynamoDbException, InterruptedException {
		model = SimpleTokenizer.INSTANCE;
		stemmer = new PorterStemmer();
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);

        addToDatabase(Config.NEWS_ARTICLE_PATH);
	}

    private void addToDatabase(String filePath) {
        Set<String> stopWords = null;

		try {
			stopWords = getStopWords();
		} catch (FileNotFoundException e1) {
			e1.printStackTrace();
		}

        BufferedReader br = null;
        try {
            String currentLine;
            br = new BufferedReader(new FileReader(filePath));

            Set<Item> accepted = new HashSet<>();
            Set<Item> accepted25 = new HashSet<>();
            while ((currentLine = br.readLine()) != null) {
                try {
                    JsonParser jsonParser = new JsonParser();
                    JsonElement elem = jsonParser.parse(currentLine);
                    JsonObject obj = elem.getAsJsonObject();

                    String article = currentLine;

                    String headline = obj.get("headline").toString();

                    int counter = 0;
			        String[] words = model.tokenize(headline);
                    // System.out.println(Arrays.toString(words));
                    for (String word: words) {
                        // Filter out non-words or stop words
                        if (stopWords.contains(word.toLowerCase()) || !(checkValidWord(word.toLowerCase()))) {
                            // System.out.println(word);
                            continue;
                        }
                        
                        // Stems words
                        PorterStemmer stemmer = new PorterStemmer();
                        String stemmedWord = stemmer.stem(word.toLowerCase());
                        
                        Item addItem = new Item().withPrimaryKey("keyword", stemmedWord, "article", article);
                        
                        if (accepted.contains(addItem)) {
                            continue;
                        }

                        accepted.add(addItem);
                        accepted25.add(addItem);
                        
                        // STEP 2: Write items to database when size reaches 25 and reset afterwards
                        // Looked at Amazon's DynamoDB documentation and used code from documentation
                        if (accepted25.size() == 25 || counter == words.length - 1) {
                            try {
                                TableWriteItems forumTableWriteItems = new TableWriteItems(TABLE_NAME)
                                        .withItemsToPut(accepted25);
                                
                                BatchWriteItemOutcome outcome = db.batchWriteItem(forumTableWriteItems);
                                
                                // Gets unprocessed items and writes it to the database
                                while (outcome.getUnprocessedItems().size() > 0) {
                                    Map<String, List<WriteRequest>> unprocessedItems = outcome.getUnprocessedItems();
                                    outcome = db.batchWriteItemUnprocessed(unprocessedItems);
                                }
                                
                                // Reset 
                                accepted25 = new HashSet<>();
                            } catch (Exception e) {
                                accepted25 = new HashSet<>();
                                continue;
                            }
                        }
                        counter += 1;
                    }
                    
                } catch (Exception e) {
                    // TODO Auto-generated catch block
                    e.printStackTrace();
                }
            }

        } catch (IOException e) {
            e.printStackTrace();
        } 
    } 

    public static Set<String> getStopWords() throws FileNotFoundException {
		Set<String> words = new HashSet<>();
		try {
			BufferedReader fileReader = new BufferedReader(new FileReader("livy/nlp_en_stop_words.txt"));
			String word = fileReader.readLine();
			
			while (word != null) {
				words.add(word);
				word = fileReader.readLine();
			}

            fileReader.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
		
		return words;
	}

    public static boolean checkValidWord(String s) {
        if (s == null) {
            return false;
        }
        
        for (int i = 0; i < s.length(); i++) {
           if ((Character.isLetter(s.charAt(i)) == false)) {
              return false;
           }
        }
        
        return true;
  }
}
