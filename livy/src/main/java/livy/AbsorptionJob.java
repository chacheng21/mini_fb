package livy;

import java.io.IOException;
import java.io.BufferedReader;
import java.io.FileReader;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import javax.naming.directory.SearchResult;

import org.apache.livy.Job;
import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.api.java.Optional;
import org.apache.spark.api.java.function.VoidFunction;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.logging.log4j.LogManager;

import livy.Database;
import config.Config;
import storage.SparkConnector;
import scala.Tuple2;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.ArrayList;
import java.util.Date;
import java.text.SimpleDateFormat;

import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.PutItemOutcome;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.UpdateItemOutcome;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.PutItemRequest;
import com.amazonaws.services.dynamodbv2.model.PutItemResult;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import storage.DynamoConnector;
import com.amazonaws.services.dynamodbv2.model.ScanRequest;
import com.amazonaws.services.dynamodbv2.document.spec.ScanSpec;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;

public class AbsorptionJob implements Job<List<MyPair<Integer,Double>>> {
	/**
	 *
	 */
	private static final long serialVersionUID = 1L;

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	DynamoDB db;
	JavaSparkContext context;

	private boolean useBacklinks;

	private String source;

	public AbsorptionJob() {
		System.setProperty("file.encoding", "UTF-8");
	}
	
	/**
	 * 
	 * main method (run to test code below)
	 */
	public static void main(String[] args) {
		final AbsorptionJob cr = new AbsorptionJob();
		try {
			cr.initialize();
			System.out.println("REACHED");
			cr.run();
		} catch (final IOException ie) {
			ie.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			cr.shutdown();
		}
	}

	public static long countNeighbors(Iterable<String> toBeCounted) {
		Iterator<String> iter = toBeCounted.iterator();
		long count = 0;
		while (iter.hasNext()) {
			iter.next();
			count++;
		}
		return count;
	}
	public void upload(List<Tuple2<String, Tuple2<String, Double>>> list) {
		ArrayList<Item> batch = new ArrayList<Item>();
		for (Tuple2<String, Tuple2<String, Double>> t : list) {
			try {
				Item item = new Item().withPrimaryKey("Label", t._2()._1()).withString("Node", t._1()).withNumber("Value", t._2()._2());
				if (batch.size() < 24) {
					batch.add(item);
				}
				else {
					TableWriteItems tempTable= new TableWriteItems("Livvy").withItemsToPut(batch);
					BatchWriteItemOutcome outcome = db.batchWriteItem(tempTable);
					// Handles Unprocessed Items
					while (outcome.getUnprocessedItems().size() > 0) {
						outcome = db.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
					}
					batch = new ArrayList<Item>();
					batch.add(item);
				}
			// PutItemOutcome res = db.getTable("Livvy").putItem(item);
			}
			catch (Exception e) {
				continue;
			}

		}
		if (batch.size() != 0) {
			TableWriteItems tempTable= new TableWriteItems("Livvy").withItemsToPut(batch);
			
			BatchWriteItemOutcome outcome = db.batchWriteItem(tempTable);
			while (outcome.getUnprocessedItems().size() > 0) {
				outcome = db.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
			}
		}
		
	}
	public void run() throws IOException, InterruptedException {
		// Load the social network
		// category, article
		JavaPairRDD<String, String> network = getNewsArticleGraph(Config.NEWS_ARTICLE_PATH);
		JavaPairRDD<String, String> friendships = getFriendships();
		JavaPairRDD<String, String> userPreferences = getPreferences();
		JavaPairRDD<String, String> userLikes = getUserLikes();
		
		JavaPairRDD<String, String> networkR = network.mapToPair(t -> new Tuple2<String,String>(t._2(), t._1()));
		network = network.union(networkR).distinct();
		friendships = friendships.union(friendships.mapToPair(t -> new Tuple2<String,String>(t._2(), t._1()))).distinct();
		
		JavaRDD<String> vertices = context.union(friendships, userPreferences, userLikes).keys().distinct();
		
		userPreferences =  userPreferences.union(userPreferences.mapToPair(t -> new Tuple2<String,String>(t._2(), t._1()))).distinct();
		userLikes = userLikes.union(userLikes.mapToPair(t -> new Tuple2<String,String>(t._2(), t._1()))).distinct();
		
		
		
		JavaPairRDD<String, Iterable<String>> networkToSum = network.groupByKey();
		JavaPairRDD<String, Long> networkNeighbors = networkToSum.mapToPair(i -> new Tuple2<String, Long>(i._1(), countNeighbors(i._2())));
		JavaPairRDD<String, Long> friendNeighbors = friendships.groupByKey().mapToPair(i -> new Tuple2<String, Long>(i._1(), countNeighbors(i._2())));
		JavaPairRDD<String, Long> prefNeighbors = userPreferences.groupByKey().mapToPair(i -> new Tuple2<String, Long>(i._1(), countNeighbors(i._2())));
		JavaPairRDD<String, Long> likeNeighbors = userLikes.groupByKey().mapToPair(i -> new Tuple2<String, Long>(i._1(), countNeighbors(i._2())));

		JavaPairRDD<String, Double> networkNeighbor = networkNeighbors.mapToPair(i -> new Tuple2<String, Double>(i._1(), i._2() != 0 ? (double) 1 / i._2() : 0.0));
		JavaPairRDD<String, Double> friendNeighbor = friendNeighbors.mapToPair(i -> new Tuple2<String, Double>(i._1(), i._2() != 0 ? (double) .3 / i._2() : 0.0));
		JavaPairRDD<String, Double> prefNeighbor = prefNeighbors.mapToPair(i -> new Tuple2<String, Double>(i._1(), i._2() != 0 ? (double) .3 / i._2() : 0.0));
		JavaPairRDD<String, Double> likeNeighbor = likeNeighbors.mapToPair(i -> new Tuple2<String, Double>(i._1(), i._2() != 0 ? (double) .4 / i._2() : 0.0));

		JavaPairRDD<String, Tuple2<String, Double>> categoryArticles = network.join(networkNeighbor);
		JavaPairRDD<String, Tuple2<String, Double>> userFriends = friendships.join(friendNeighbor);
		JavaPairRDD<String, Tuple2<String, Double>> userPref = userPreferences.join(prefNeighbor);
		JavaPairRDD<String, Tuple2<String, Double>> userLike = userLikes.join(likeNeighbor);

		// Edge (u, (v, w(u,v)))
		JavaPairRDD<String, Tuple2<String, Double>> edges = context.union(categoryArticles, userFriends, userPref, userLike).distinct();
		
		networkToSum.unpersist();
		networkNeighbors.unpersist();
		friendNeighbors.unpersist();
		prefNeighbors.unpersist();
		likeNeighbors.unpersist();
		networkNeighbor.unpersist();
		friendNeighbor.unpersist();
		prefNeighbor.unpersist();
		likeNeighbor.unpersist();
		friendships.unpersist();
		userPreferences.unpersist();
		userLikes.unpersist();
		network.unpersist();
		networkR.unpersist();
		// categoryArticles.union(userFriends).union(userPref).union(userLike).distinct();
		
		networkToSum.unpersist();

		
		JavaPairRDD<String, Tuple2<String, Double>> labels = vertices.mapToPair(i -> new Tuple2<String, Tuple2<String, Double>>(i, new Tuple2<String, Double>(i, 1.0)));

		// JavaPairRDD<String, Tuple2<Double, Tuple2<String, Double>>> adsorption = edges.mapToPair(i -> new Tuple2<String, Tuple2<Double, Tuple2<String, Double>>>(i._1(), new Tuple2<Double, Tuple2<String, Double>>(1.0, new Tuple2<String,Double>(i._2()._1(),i._2()._2()))));
		// 15 iterations of adsorption
		int x = 0; 
		JavaPairRDD<String, Tuple2<Tuple2<String, Double>, Optional<Tuple2<String, Double>>>> joined;
		JavaPairRDD<String, Tuple2<Tuple2<String, Double>, Tuple2<String, Double>>>  joined2;
		JavaPairRDD<String, Tuple2<String, Tuple2<String, Double>>> product;
		JavaPairRDD<Tuple2<String,String>, Double> reversed;
		JavaPairRDD<Tuple2<String,String>, Double> grouped;
		JavaPairRDD<String, Double> sums;
		JavaPairRDD<String, Tuple2<Tuple2<String, Double>, Double>> toBeJoined;
		while (x < 15) {
			System.out.println(x);
		
			// RDD 1: Source, Destination, Weight
			// RDD2: Source, Label, Value
			

			// Join: Source, Destination, Weight, Label, Value
			joined = edges.leftOuterJoin(labels);
			
			// Filters out Nodes without Any labels
			joined = joined.filter(i -> i._2()._2().isPresent());
			joined2 = joined.mapToPair(i -> new Tuple2<String, Tuple2<Tuple2<String, Double>, Tuple2<String, Double>>>(i._1(), new Tuple2<Tuple2<String, Double>, Tuple2<String, Double>>(i._2()._1(), i._2()._2().get())));
			
			// Source, Destination, Label, Product (Weight * Value)
			product = joined2.mapToPair(i -> new Tuple2<String, Tuple2<String, Tuple2<String, Double>>>(i._1(), new Tuple2<String, Tuple2<String, Double>>(i._2()._1()._1(), new Tuple2<String, Double>(i._2()._2()._1(), i._2()._1()._2() * i._2()._2()._2()))));
			// Destination, Label, Product
			reversed = product.mapToPair(i -> new Tuple2<Tuple2<String,String>, Double>((new Tuple2<String, String>(i._2()._1(), i._2()._2()._1())), i._2()._2()._2()));
			
			// Destination, Label, Sum of Products
			grouped = reversed.reduceByKey((a,b) -> a+b);
			// (Destination, Label, Sum of Product) is the new <Line 143>		
			labels = grouped.mapToPair(i -> new Tuple2<String, Tuple2<String, Double>>(i._1()._1(), new Tuple2<String, Double>(i._1()._2(),  i._2())));
			// Hardcode node's self-labels to be 1
			labels = labels.mapToPair(i -> new Tuple2<String, Tuple2<String, Double>>(i._1(), new Tuple2<String,Double>(i._2()._1(), i._2()._1().equals(i._1()) ? 1.0 : i._2()._2())));
			// Normalize labels across the given node
			sums = labels.mapToPair(i -> new Tuple2<String, Double>(i._1(), i._2()._2()));
			sums = sums.reduceByKey((a,b) -> a + b);
			toBeJoined = labels.join(sums);
			labels = toBeJoined.mapToPair(i -> new Tuple2<String, Tuple2<String, Double>>(i._1(), new Tuple2<String, Double>(i._2()._1()._1(), i._2()._2() != 0 ? i._2()._1()._2()/i._2()._2() : 0)));
			x++;
		}
		System.out.println("Success!");
		System.out.println("Going to start collecting");
		
		
		/*labels.foreachPartition(new VoidFunction<Iterator<Tuple2<String, Tuple2<String, Double>>>>() {
			@Override
			public void call(Iterator<Tuple2<String, Tuple2<String, Double>>> iter) {
				/*DynamoDB db2 = new DynamoDB( 
					AmazonDynamoDBClientBuilder.standard()
					.withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration(
						Config.DYNAMODB_URL, "us-east-1"))
					.withCredentials(new DefaultAWSCredentialsProviderChain())
					.build());
				ArrayList<Item> batch = new ArrayList<Item>();
				while (iter.hasNext()) {
					Tuple2<String, Tuple2<String, Double>> t = iter.next();
					Item item = new Item().withPrimaryKey("Label", t._2()._1()).withString("Node", t._1()).withNumber("Value", t._2()._2());
					if (batch.size() < 24) {
						batch.add(item);
					}
					else {
						TableWriteItems tempTable= new TableWriteItems("Livvy").withItemsToPut(batch);
						BatchWriteItemOutcome outcome = db2.batchWriteItem(tempTable);
						// Handles Unprocessed Items
						while (outcome.getUnprocessedItems().size() > 0) {
							outcome = db2.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
							
						}
						batch = new ArrayList<Item>();
						batch.add(item);
					}
				}
				if (batch.size() != 0) {
					TableWriteItems tempTable= new TableWriteItems("Livvy").withItemsToPut(batch);
					
					BatchWriteItemOutcome outcome = db2.batchWriteItem(tempTable);
					while (outcome.getUnprocessedItems().size() > 0) {
						outcome = db2.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
						
					}
				}
			}
			
		});*/
		
		List<Tuple2<String, Tuple2<String, Double>>> list = labels.collect();
		System.out.println("Finished Collecting. Uploading");
		upload(list);
		// return labels;
		/*
		labels.foreach(t -> 
			{
				DynamoDB db2 = new DynamoDB( 
					AmazonDynamoDBClientBuilder.standard()
					.withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration(
						"https://dynamodb.us-east-1.amazonaws.com", "us-east-1"))
					.withCredentials(new DefaultAWSCredentialsProviderChain())
					.build());
				Item item = new Item().withPrimaryKey("Label", t._2()._1()).withString("Node", t._1()).withNumber("Value", t._2()._2());
				PutItemOutcome res = db2.getTable("Livvy").putItem(item);	
			});*/
		System.out.println("Done");
	}

	/**
	 * Initialize the database connection and open the file
	 *
	 * @throws IOException
	 * @throws InterruptedException
	 * @throws DynamoDbException
	 */
	public void initialize() throws IOException, InterruptedException {
		System.out.println("Connecting to Spark...");
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();

		System.out.println("Connected!");
	}

	JavaPairRDD<String, String> getFriendships(){
	
		ItemCollection<ScanOutcome> scanResult = db.getTable("Friends").scan(new ScanSpec());
		List<Tuple2<String, String>> list = new ArrayList<Tuple2<String, String>>();
		for (Item i : scanResult) {
			list.add(new Tuple2<String,String>(i.get("Username").toString(), i.get("Friend Name").toString()));
		}
		JavaPairRDD<String, String> output = context.parallelizePairs(list);
		return output;
	}

	JavaPairRDD<String, String> getPreferences() {
		ItemCollection<ScanOutcome> scanResult = db.getTable("Accounts").scan(new ScanSpec());
		List<Tuple2<String, List<String>>> list = new ArrayList<Tuple2<String, List<String>>>();
		for (Item i : scanResult) {
			list.add(new Tuple2<String, List<String>>(i.get("Username").toString(), i.getList("Categories")));
		}
		JavaPairRDD<String, List<String>> preferences = context.parallelizePairs(list);
		JavaPairRDD<String, String> output = preferences.flatMapValues(i -> i.iterator());
		return output; 
	}

	JavaPairRDD<String, String> getUserLikes() {
		ItemCollection<ScanOutcome> scanResult = db.getTable("ArticleLikes").scan(new ScanSpec());

		List<Tuple2<String, String>> list = new ArrayList<Tuple2<String, String>>();
		for (Item i : scanResult) {
			list.add(new Tuple2<String,String>(i.get("user").toString(), i.get("article").toString()));
		}
		JavaPairRDD<String, String> outcome = context.parallelizePairs(list);
		return outcome;
	}

	/**
	 * Read Articles Dataset, and generate edge list 
	 *
	 * @param filePath
	 * @return JavaPairRDD: (category, article)
	 */
	JavaPairRDD<String, String> getNewsArticleGraph(String filePath) {
		// Read JSON file 
		JavaRDD<String> file = context.textFile(filePath, 100);
		// Generate Edge List, where key is news category, value is news article as a JSON 
		JavaPairRDD<String, String> graph = file.mapToPair(i -> {
			JsonParser jsonParser = new JsonParser();
			JsonElement elem = jsonParser.parse(i);
			JsonObject obj = elem.getAsJsonObject();

			String category = obj.get("category").toString().replace("\"", "");

			
			return new Tuple2<String, String>(category, i);
		});

		// Get subgraph of above where new articles' date is before or equal to today's date
		JavaPairRDD<String, String> subgraph = graph.filter(i -> {
			JsonParser jsonParser = new JsonParser();
			JsonElement elem = jsonParser.parse(i._2());
			JsonObject obj = elem.getAsJsonObject();

			String date = obj.get("date").toString().replace("\"", "");
			int year = Integer.valueOf(date.substring(0, 4));
			String monthAndDay = date.substring(4);

			//Add 4 to the year
			String dateAddFourYears = String.valueOf(year + 4) + monthAndDay;
			
			SimpleDateFormat sdformat = new SimpleDateFormat("yyyy-MM-dd");
			Date d1 = sdformat.parse(dateAddFourYears);
			Date currentDate = new Date();

			return (d1.compareTo(currentDate) <= 0);
		});

		return subgraph;
	}

	private JavaRDD<Integer> getSinks(JavaPairRDD<Integer,Integer> network) {
		JavaRDD<Integer> followers = network.keys().distinct();

		JavaRDD<Integer> nodes = followers.union(network.values().distinct()).distinct();

		return nodes.subtract(followers);
	}

	/**
	 * Main functionality in the program: read and process the social network
	 *
	 * @throws IOException File read, network, and other errors
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */

	
	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		System.out.println("Shutting down");
	}

	

	
	@Override
	public List<MyPair<Integer,Double>> call(JobContext arg0) throws Exception {
		initialize();
		run();
		// FIX BELOW
		return null;
	} 
	

}
