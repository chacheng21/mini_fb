package livy;

import java.util.ArrayList;

import java.util.Iterator;
import java.util.List;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.spec.ScanSpec;

import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;
import config.Config;
import scala.Tuple2;
import storage.DynamoConnector;
import storage.SparkConnector;


public class Database {
    private DynamoDB db;
    private Table usersTable;
    private Table likesTable;
    private Table friendsTable;
 
    private JavaPairRDD<String, String> usersAndCategories;
    private JavaPairRDD<String, String> usersAndArticles;
    private JavaPairRDD<String, String> friends;
 
    private SparkSession spark;
	private JavaSparkContext context;

    public Database() {
        try {
            initialize();
        } catch (Exception e) {
            e.printStackTrace();
        }
        
    }

    private void initialize() throws DynamoDbException, InterruptedException {
        db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
        spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();

        usersTable = db.getTable("Accounts");
        likesTable = db.getTable("ArticleLikes");
        friendsTable = db.getTable("Friends");

        runUsersAndCategories();
        runUsersAndArticles();
        runFriends();
    }

    private void runUsersAndCategories() {
        ScanSpec scanSpec = new ScanSpec();

        try {
            ItemCollection<ScanOutcome> items = usersTable.scan(scanSpec);

            List<String[]> list = new ArrayList<>();

            Iterator<Item> iterate = items.iterator();
            while (iterate.hasNext()) {
                Item item = iterate.next();
                List<String> categories = item.getList("Categories");
                for (String category : categories) {
                    String[] arr = new String[2];
                    arr[0] = item.getString("Username");
                    arr[1] = category;

                    list.add(arr);
                }
            }

            JavaRDD<String[]> rdd = context.parallelize(list);
            this.usersAndCategories = rdd.mapToPair(i -> new Tuple2<String, String>(i[0], i[1]));

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void runUsersAndArticles() {
        ScanSpec scanSpec = new ScanSpec();

        try {
            ItemCollection<ScanOutcome> items = likesTable.scan(scanSpec);

            List<String[]> list = new ArrayList<>();

            Iterator<Item> iterate = items.iterator();
            while (iterate.hasNext()) {
                Item item = iterate.next();
                String[] arr = new String[2];
                arr[0] = item.getString("user");
                arr[1] = item.getString("article");

                list.add(arr);
            }

            JavaRDD<String[]> rdd = context.parallelize(list);
            this.usersAndArticles = rdd.mapToPair(i -> new Tuple2<String, String>(i[0], i[1]));

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void runFriends() {
        ScanSpec scanSpec = new ScanSpec();

        try {
            ItemCollection<ScanOutcome> items = friendsTable.scan(scanSpec);

            List<String[]> list = new ArrayList<>();

            Iterator<Item> iterate = items.iterator();
            while (iterate.hasNext()) {
                Item item = iterate.next();
                String[] arr = new String[2];
                arr[0] = item.getString("Username");
                arr[1] = item.getString("Friend Name");

                list.add(arr);
            }

            JavaRDD<String[]> rdd = context.parallelize(list);
            this.friends = rdd.mapToPair(i -> new Tuple2<String, String>(i[0], i[1]));

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public JavaPairRDD<String, String> getUsersAndCategories() {
        return this.usersAndCategories;
    }

    public JavaPairRDD<String, String> getUsersAndArticles() {
        return this.usersAndArticles;
    }

    public JavaPairRDD<String, String> getFriends() {
        return this.friends;
    }


}
